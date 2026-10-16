"""Builds a venue's room from a layout.v1 file in Blender (bpy) and exports it as a GLB: the floor, walls with the door's
opening and the window, each zone's patch of floor, every table by its shape with its chairs, in simple warm materials.
Object names carry the ids (table:w3, zone:window) so a viewer can hit-test by name. Draco is not needed: a room this
simple is small. Run (bpy 5.x, Python 3.11):

    python bake.py ../fixtures/olea.layout.json /tmp/olea.glb [--png /tmp/olea.png]

The GLB is never committed when it is over 3 MB (seating/README.md). Metres throughout; the plan's x is Blender's X and
the plan's z (depth, down the page) is Blender's -Y, which the glTF exporter turns into +Z, so the room keeps the plan's
coordinates in a viewer: a table at plan (x, z) stands at glTF (x, 0, z)."""
import json, math, sys, time
import bpy

WALL_H, WALL_T, TABLE_H, CHAIR_H = 3.0, 0.12, 0.75, 0.45
COLORS = {  # warm, matte: the dark table palette of the guest menu
    'floor': (0.16, 0.10, 0.06, 1), 'zone': (0.22, 0.15, 0.09, 1), 'wall': (0.36, 0.30, 0.25, 1), 'window': (0.72, 0.78, 0.82, 1),
    'door': (0.30, 0.20, 0.12, 1), 'top': (0.30, 0.19, 0.11, 1), 'leg': (0.08, 0.06, 0.05, 1), 'chair': (0.40, 0.33, 0.26, 1), 'bar': (0.20, 0.13, 0.08, 1),
}


def material(name, rgba, rough=0.7, alpha=1.0, emit=0.0):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba; bsdf.inputs['Roughness'].default_value = rough
    if alpha < 1: bsdf.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND'
    if emit: bsdf.inputs['Emission Color'].default_value = rgba; bsdf.inputs['Emission Strength'].default_value = emit
    return m


def box(name, cx, cy, cz, sx, sy, sz, mat, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz), rotation=(0, 0, rot))
    o = bpy.context.active_object; o.name = name; o.scale = (sx, sy, sz); o.data.materials.append(mat); return o


def cyl(name, cx, cy, cz, r, h, mat, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(cx, cy, cz))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat); return o


def footprint(t):  # the same sizes as apps/view/src/seat/plan.js
    s = t['seats']
    if t['shape'] == 'round': r = 0.3 + min(8, s) * 0.045; return {'r': r, 'w': 2 * r, 'h': 2 * r}
    if t['shape'] == 'square': k = 0.72 if s <= 2 else 0.92; return {'w': k, 'h': k}
    if t['shape'] == 'long': return {'w': 1 + math.ceil(s / 2) * 0.62, 'h': 0.92}
    return {'w': max(2.2, s * 0.58), 'h': 0.5}


def seats_of(t):  # [x, z, angle] around the footprint, as plan.js places them
    fp, n, out = footprint(t), t['seats'], []
    if t['shape'] == 'round':
        for i in range(n):
            a = -math.pi / 2 + i * 2 * math.pi / n; R = fp['r'] + 0.24; out.append((math.cos(a) * R, math.sin(a) * R, a + math.pi / 2))
        return out
    if t['shape'] == 'bar':
        step = fp['w'] / n
        for i in range(n): out.append((-fp['w'] / 2 + step * (i + 0.5), fp['h'] / 2 + 0.3, 0))
        return out
    sides = [(0, -1), (0, 1)] if t['shape'] != 'square' or n <= 2 else [(0, -1), (1, 0), (0, 1), (-1, 0)]
    per, left = math.ceil(n / len(sides)), n
    for sx, sz in sides:
        k = min(per, left); left -= k
        for i in range(k):
            along = (i - (k - 1) / 2) * (0.62 if t['shape'] == 'long' else 0.5)
            if sz: out.append((along, sz * (fp['h'] / 2 + 0.22), math.pi if sz < 0 else 0))
            else: out.append((sx * (fp['w'] / 2 + 0.22), along, math.pi / 2 if sx < 0 else -math.pi / 2))
    return out


def build(layout):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W, D = layout['room']['w'], layout['room']['d']
    Y = lambda z: -z  # plan depth → Blender -Y
    m = {k: material(k, v) for k, v in COLORS.items()}
    m['window'] = material('window', COLORS['window'], rough=0.1, alpha=0.35)
    box('floor', W / 2, Y(D / 2), -0.05, W, D, 0.1, m['floor'])
    for z in layout['zones']:
        x1, z1, x2, z2 = z['rect']
        box('zone:' + z['id'], (x1 + x2) / 2, Y((z1 + z2) / 2), 0.005, x2 - x1 - 0.2, z2 - z1 - 0.2, 0.01, m['zone'])
    for i, w in enumerate(layout['walls']):
        (ax, az), (bx, bz) = w['from'], w['to']; L = math.hypot(bx - ax, bz - az); ang = math.atan2(Y(bz) - Y(az), bx - ax)
        seg = lambda a, b, name, mat, h=WALL_H, z0=0.0: box(name, ax + (bx - ax) * (a + b) / (2 * L), Y(az + (bz - az) * (a + b) / (2 * L)), z0 + h / 2, b - a, WALL_T, h, mat, rot=ang)
        if w.get('kind') == 'door' and w.get('gap'):
            g0, g1 = w['gap']; seg(0, g0, f'wall:{i}a', m['wall']); seg(g1, L, f'wall:{i}b', m['wall']); seg(g0, g1, f'wall:{i}lintel', m['wall'], h=WALL_H - 2.1, z0=2.1)
            # the leaf, open into the room: hinged at the gap's start, turned 90° off the wall
            d = g1 - g0; hx, hy = ax + (bx - ax) * g0 / L, Y(az + (bz - az) * g0 / L); nx, ny = (Y(bz) - Y(az)) / L, -(bx - ax) / L
            box(f'door:{i}', hx + nx * d / 2, hy + ny * d / 2, 1.05, d, 0.05, 2.1, m['door'], rot=ang + math.pi / 2)
        elif w.get('kind') == 'window':
            seg(0, L, f'wall:{i}sill', m['wall'], h=0.9); seg(0, L, f'wall:{i}head', m['wall'], h=WALL_H - 2.4, z0=2.4); seg(0, L, f'window:{i}', m['window'], h=1.5, z0=0.9)
        else:
            seg(0, L, f'wall:{i}', m['wall'])
    for t in layout['tables']:
        fp, cx, cy, rot = footprint(t), t['x'], Y(t['z']), -math.radians(t.get('rot', 0))
        name = 'table:' + t['id']
        if t['shape'] == 'round':
            cyl(name, cx, cy, TABLE_H - 0.02, fp['r'], 0.04, m['top']); cyl(name + ':leg', cx, cy, TABLE_H / 2, 0.05, TABLE_H, m['leg'], 12); cyl(name + ':foot', cx, cy, 0.015, fp['r'] * 0.6, 0.03, m['leg'], 24)
        elif t['shape'] == 'bar':
            box(name, cx, cy, 0.55, fp['w'], fp['h'], 1.1, m['bar'], rot=rot); box(name + ':top', cx, cy, 1.12, fp['w'] + 0.1, fp['h'] + 0.1, 0.05, m['top'], rot=rot)
        else:
            box(name, cx, cy, TABLE_H - 0.02, fp['w'], fp['h'], 0.04, m['top'], rot=rot)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    lx, ly = sx * (fp['w'] / 2 - 0.08), sy * (fp['h'] / 2 - 0.08); c, s = math.cos(rot), math.sin(rot)
                    box(f'{name}:leg{sx}{sy}', cx + lx * c - ly * s, cy + lx * s + ly * c, (TABLE_H - 0.04) / 2, 0.05, 0.05, TABLE_H - 0.04, m['leg'], rot=rot)
        for j, (sx, sz, a) in enumerate(seats_of(t)):
            # in plan units first (x right, z down, the table's rot clockwise as SVG turns it), then to Blender (z → -Y)
            r = math.radians(t.get('rot', 0)); c, s = math.cos(r), math.sin(r)
            qx, qz = sx * c - sz * s, sx * s + sz * c
            if t['shape'] == 'round': k = math.hypot(qx, qz) or 1; ox, oz = qx / k, qz / k                    # away from the table
            else: ux, uz = -math.sin(a), math.cos(a); ox, oz = ux * c - uz * s, ux * s + uz * c
            px, py = cx + qx, Y(t['z'] + qz)
            if t['shape'] == 'bar': cyl(f'{name}:stool{j}', px, py, 0.7, 0.16, 0.06, m['chair'], 16); cyl(f'{name}:stoolleg{j}', px, py, 0.35, 0.03, 0.7, m['leg'], 8)
            else:
                yaw = math.atan2(-oz, ox) - math.pi / 2                                                          # the back's thin side lies along "away"
                box(f'{name}:seat{j}', px, py, CHAIR_H - 0.03, 0.42, 0.42, 0.06, m['chair'], rot=yaw)
                box(f'{name}:back{j}', cx + qx + 0.19 * ox, Y(t['z'] + qz + 0.19 * oz), CHAIR_H + 0.22, 0.42, 0.04, 0.5, m['chair'], rot=yaw)
    # one warm lamp over the room's middle, for a quick render; viewers light the room themselves
    bpy.ops.object.light_add(type='POINT', location=(W / 2, Y(D / 2), 2.6)); lamp = bpy.context.active_object; lamp.data.energy = 900; lamp.data.color = (1.0, 0.82, 0.6)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; png = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None
    src, out = args[0], args[1]
    with open(src, encoding='utf-8') as f: layout = json.load(f)
    assert layout.get('v') == 1 and layout.get('room') and layout.get('tables'), 'not a layout.v1'
    t0 = time.time(); build(layout); t1 = time.time()
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_lights=True)
    t2 = time.time()
    if png:
        sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE' if hasattr(bpy.types, 'SceneEEVEE') else sc.render.engine
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 960, 640, 100
        bpy.ops.object.camera_add(location=(layout['room']['w'] * 1.15, -layout['room']['d'] * 1.35, 7.5), rotation=(math.radians(58), 0, math.radians(38)))
        sc.camera = bpy.context.active_object; sc.render.filepath = png; bpy.ops.render.render(write_still=True)
    import os
    print(json.dumps({'objects': len(bpy.data.objects), 'build_s': round(t1 - t0, 2), 'export_s': round(t2 - t1, 2), 'glb_bytes': os.path.getsize(out), 'render_s': round(time.time() - t2, 2) if png else None}))


if __name__ == '__main__': main()
