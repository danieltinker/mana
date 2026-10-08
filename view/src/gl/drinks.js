/* Drinks drawn in code: a bottle, can or tap, the right glass, what is in it, and the pour.
   One builder for every drink; shapes come from profiles (drinks/spec.js), turned on a lathe and shared between items, so a row
   of ten wines costs ten sets of materials and one set of geometry. Nothing is simulated: the liquid is the inside of the glass
   with everything above one height thrown away, and the pour is a timeline (drinks/pour.js) that sets that height.

   build(spec, text) → { group, shared, update(pose, frame), paint(text), tris, dispose() }
     pose   from pourAt() or REST(): where the bottle is, how full the glass is
     frame  { cx, cz, wx, wz, baseY, yaw, refl }  camera, where the item stands, how far the diner has turned the bottle */
import {
  LatheGeometry, CylinderGeometry, CircleGeometry, PlaneGeometry, Mesh, Group, Points, BufferGeometry, BufferAttribute, ShaderMaterial, CanvasTexture,
  Vector2, Vector3, Color, DoubleSide, CustomBlending, AddEquation, OneFactor, ZeroFactor, LinearMipmapLinearFilter
} from 'three';
import * as SH from './shaders.js';
import { U as CM, VESSELS, GLASSES, radiusAt, tiltPose } from '../drinks/spec.js';
import { paintLabel } from '../drinks/label.js';

const PI = Math.PI;
const ADD = { transparent: true, depthWrite: false, blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor };

export function createDrinkKit(ctx) {
  const geos = new Map(); let live = 0;
  const take = (key, make) => { let e = geos.get(key); if (!e) { e = { g: make(), refs: 0 }; geos.set(key, e); } e.refs++; return e.g; };
  const drop = (key) => { const e = geos.get(key); if (e && --e.refs <= 0) { e.g.dispose(); geos.delete(key); } };
  const turn = (pts, seg) => new LatheGeometry(pts.map((p) => new Vector2(Math.max(p[0], .0005) * CM, p[1] * CM)), seg);
  const sleeve = (V, range, grow, n) => { const pts = []; for (let i = 0; i <= n; i++) { const y = range[0] + (range[1] - range[0]) * i / n; pts.push([radiusAt(V.p, Math.min(y, V.h - .01)) + grow, y]); } pts.push([0, range[1]]); return pts; };

  function build(spec, text) {
    live++;
    const g = new Group(), keys = [], texs = [], canvases = [];
    const sh = { uCam: { value: ctx.cam }, uReveal: { value: 0 }, uLight: { value: 1 }, uSat: { value: 1 }, uGlow: ctx.U.glow, uMirror: { value: 0 }, uRefl: ctx.U.refl, uLampPos: ctx.lampPos, uTime: ctx.U.time };
    const geo = (key, make) => { keys.push(key); return take(key, make); };
    const mat = (fs, u, o) => new ShaderMaterial(Object.assign({ uniforms: Object.assign({}, sh, u), vertexShader: SH.DRINK_VS, fragmentShader: fs, transparent: true, side: DoubleSide }, o || {}));
    const mesh = (parent, gm, m, order) => { const x = new Mesh(gm, m); x.renderOrder = order || 0; x.frustumCulled = false; parent.add(x); return x; };
    const mirG = new Group(); mirG.scale.y = -1; g.add(mirG);                  // what the counter reflects
    const mirror = (parent, src) => { const m = src.material, c = new Mesh(src.geometry, new ShaderMaterial({ uniforms: Object.assign({}, m.uniforms, { uMirror: { value: 1 } }), vertexShader: m.vertexShader, fragmentShader: m.fragmentShader, transparent: true, side: DoubleSide, depthTest: false, depthWrite: false }));
      c.position.copy(src.position); c.rotation.copy(src.rotation); c.renderOrder = -1.5; c.frustumCulled = false; parent.add(c); return c; };
    const blob = (r) => { const m = mesh(g, geo('quad', () => new PlaneGeometry(1, 1)), new ShaderMaterial({ uniforms: { uK: { value: 0 } }, vertexShader: SH.UV_VS, fragmentShader: SH.BLOB_FS, transparent: true, depthWrite: false }), -2); m.rotation.x = -PI / 2; m.position.y = .006; m.scale.set(r * 2.9, r * 2.5, 1); return m; };
    const printed = (w, h, style) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new CanvasTexture(cv); t.anisotropy = ctx.maxAniso; t.minFilter = LinearMipmapLinearFilter; canvases.push({ cv, t, style }); texs.push(t); return t; };
    const look = { ink: spec.ink, paper: spec.paper, wrap: spec.wrap };

    /* ---- the bottle, can or tap ---- */
    let B = null;
    if (spec.bottle) {
      const V = VESSELS[spec.vessel], half = V.h * CM / 2, pos = new Group(), tilt = new Group(), yaw = new Group(), base = new Group(), mYaw = new Group();
      pos.add(tilt); tilt.add(yaw); yaw.add(base); base.position.y = -half; g.add(pos); mirG.add(mYaw);
      B = { V, half, pos, tilt, yaw, mYaw, kind: spec.vessel, shadow: blob(V.r * CM) };
      if (spec.vessel === 'tap') {
        const metal = { uUseMap: { value: 0 }, map: { value: ctx.blank }, uTint: { value: new Color(.74, .56, .30) }, uMetal: { value: 1 } };      // brass
        mesh(base, geo('tap:column', () => turn(V.p, 32)), mat(SH.SOLID_FS, metal, { depthWrite: true }));
        const L = V.spout[0] * CM, y = V.spout[1] * CM;
        const arm = mesh(base, geo('tap:arm', () => new CylinderGeometry(.062, .075, 1, 16)), mat(SH.SOLID_FS, metal, { depthWrite: true })); arm.rotation.z = PI / 2; arm.scale.y = L; arm.position.set(L / 2, y, 0);
        const noz = mesh(base, geo('tap:noz', () => new CylinderGeometry(.05, .04, .2, 14)), mat(SH.SOLID_FS, metal, { depthWrite: true })); noz.position.set(L, y - .11, 0);
        B.handle = new Group(); B.handle.position.set(L * .78, y + .05, 0); base.add(B.handle);
        mesh(B.handle, geo('tap:handle', () => turn([[0, 0], [.5, 0], [.55, .5], [.8, 2.6], [1.15, 6.6], [1.2, 8.2], [.9, 8.9], [0, 9.1]], 20)), mat(SH.SOLID_FS, { uUseMap: { value: 0 }, map: { value: ctx.blank }, uTint: { value: new Color(.07, .06, .055) }, uMetal: { value: .22 } }, { depthWrite: true }));
        const plate = mesh(base, geo('tap:plate', () => new PlaneGeometry(.36, .36)), mat(SH.SOLID_FS, { uUseMap: { value: 1 }, map: { value: printed(256, 256, 'badge') }, uTint: { value: new Color(1, 1, 1) }, uMetal: { value: 0 } }, { depthWrite: true }), 1);
        plate.position.set(0, 11.6 * CM, V.p[5][0] * CM + .012);
        B.spoutAt = [L, y - .2];
      } else if (spec.vessel === 'can') {
        const body = mesh(base, geo('can:body', () => turn(V.p, 40)), mat(SH.SOLID_FS, { uUseMap: { value: 0 }, map: { value: ctx.blank }, uTint: { value: new Color(.80, .81, .82) }, uMetal: { value: 1 } }, { depthWrite: true }));
        const wrap = mesh(base, geo('can:wrap', () => new CylinderGeometry(V.r * CM * 1.004, V.r * CM * 1.004, (V.label[1] - V.label[0]) * CM, 40, 1, true, -PI, 2 * PI)), mat(SH.SOLID_FS, { uUseMap: { value: 1 }, map: { value: printed(1024, 448, 'can') }, uTint: { value: new Color(1, 1, 1) }, uMetal: { value: .16 } }, { depthWrite: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 1);
        wrap.position.y = (V.label[0] + V.label[1]) / 2 * CM;
        mirror(mYaw, body); mirror(mYaw, wrap);
      } else {
        const clearFill = !spec.dark && spec.liquid;
        B.glassU = { uTint: { value: new Color().fromArray(spec.glassTint) }, uDark: { value: spec.dark }, uInside: { value: new Color().fromArray(spec.liquid ? spec.liquid.deep.map((v, i) => v * .55 + spec.liquid.edge[i] * .45) : [0, 0, 0]) }, uHasFill: { value: clearFill ? 1 : 0 }, uUp: { value: new Vector3(0, 1, 0) }, uFillD: { value: V.fill * CM } };
        const body = mesh(base, geo('bottle:' + spec.vessel, () => turn(V.p, 40)), mat(SH.GLASS_FS, B.glassU, { depthWrite: true }));
        const a = V.label[2] * PI / 180, lh = (V.label[1] - V.label[0]) * CM, lr = V.r * CM * 1.006;
        const label = mesh(base, geo('label:' + spec.vessel, () => new CylinderGeometry(lr, lr, lh, 28, 1, true, -a, 2 * a)), mat(SH.SOLID_FS, { uUseMap: { value: 1 }, map: { value: printed(512, Math.round(512 * lh / (2 * a * lr)), spec.beer ? 'beer' : 'wine') }, uTint: { value: new Color(1, 1, 1) }, uMetal: { value: 0 } }, { depthWrite: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 1);
        label.position.y = (V.label[0] + V.label[1]) / 2 * CM;
        mirror(mYaw, body); mirror(mYaw, label);
        if (V.back && text.back && text.back.length) {
          const b = V.back[2] * PI / 180, bh = (V.back[1] - V.back[0]) * CM;
          const back = mesh(base, geo('back:' + spec.vessel, () => new CylinderGeometry(lr, lr, bh, 16, 1, true, PI - b, 2 * b)), mat(SH.SOLID_FS, { uUseMap: { value: 1 }, map: { value: printed(256, Math.round(256 * bh / (2 * b * lr)), 'back') }, uTint: { value: new Color(1, 1, 1) }, uMetal: { value: 0 } }, { depthWrite: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 1);
          back.position.y = (V.back[0] + V.back[1]) / 2 * CM;
        }
        if (V.capsule && spec.foil) {
          const cap = mesh(base, geo('cap:' + spec.vessel, () => turn(sleeve(V, V.capsule, .05, 10), 28)), mat(SH.SOLID_FS, { uUseMap: { value: 0 }, map: { value: ctx.blank }, uTint: { value: new Color().fromArray(spec.foil) }, uMetal: { value: spec.vessel === 'longneck' ? .95 : .7 } }, { depthWrite: true }), 1);
          mirror(mYaw, cap);
        }
      }
    }

    /* ---- the glass and what is in it ---- */
    const G = GLASSES[spec.glass], gG = new Group(), mG = new Group(), y0 = G.inner[0][1], headCm = spec.beer ? G.head : spec.sparkling ? 1.3 : 0;
    gG.position.set(spec.glassAt[0], 0, spec.glassAt[1]); mG.position.copy(gG.position); g.add(gG); mirG.add(mG);
    const gr = Math.max.apply(null, G.outer.map((p) => p[0])) * CM, gShadow = blob(gr * .8); gShadow.position.x = spec.glassAt[0]; gShadow.position.z = spec.glassAt[1];
    let liquid = null, top = null, bubbles = null, stream = null, glow = null;
    if (spec.liquid) {
      const lu = { uDeep: { value: new Color().fromArray(spec.liquid.deep) }, uEdge: { value: new Color().fromArray(spec.liquid.edge) }, uFoamCol: { value: new Color().fromArray(spec.liquid.foam) },
        uLevel: { value: 0 }, uFoam: { value: 0 }, uWob: { value: new Vector2() }, uAt: { value: new Vector3() }, uAlpha: { value: 1 }, uFoamy: { value: 0 } };
      liquid = mesh(gG, geo('liquid:' + spec.glass, () => turn(G.inner.map((p) => [p[0] * .982, p[1]]), 44)), mat(SH.LIQUID_FS, lu, { depthWrite: true }), 2);
      top = mesh(gG, geo('disc', () => new CircleGeometry(1, 40).rotateX(-PI / 2)), mat(SH.SURFACE_FS, lu, { depthWrite: true }), 2.2);
      mirror(mG, liquid);
      if (ctx.motion) {
        const n = spec.beer ? 44 : spec.sparkling ? 52 : 18;
        bubbles = new Points(geo('bubbles:' + n, () => { const p = new Float32Array(n * 3), s = new Float32Array(n); for (let i = 0; i < n; i++) { const a = i * 2.39996, r = Math.sqrt((i + .5) / n); p[i * 3] = Math.cos(a) * r; p[i * 3 + 2] = Math.sin(a) * r; s[i] = (i * .6180339) % 1; }
          const bg = new BufferGeometry(); bg.setAttribute('position', new BufferAttribute(p, 3)); bg.setAttribute('aSeed', new BufferAttribute(s, 1)); return bg; }),
        new ShaderMaterial(Object.assign({ uniforms: { uTime: ctx.U.time, uPx: ctx.U.px, uOn: { value: 0 }, uBase: { value: 0 }, uTop: { value: 1 }, uR: { value: .2 }, uSize: { value: spec.sparkling ? 5 : 7 }, uCol: { value: new Color(1, .96, .86) }, uGlow: ctx.U.glow }, vertexShader: SH.BUBBLE_VS, fragmentShader: SH.BUBBLE_FS, depthTest: false }, ADD)));
        bubbles.frustumCulled = false; bubbles.renderOrder = 3; bubbles.visible = false; gG.add(bubbles);
        stream = mesh(g, geo('stream', () => new CylinderGeometry(1, 1, 1, 8, 16, true)), new ShaderMaterial({ uniforms: { uA: { value: new Vector3() }, uB: { value: new Vector3() }, uR: { value: spec.beer ? .042 : .028 }, uEdge: lu.uEdge, uDeep: lu.uDeep, uHead: { value: 0 }, uTail: { value: 1 }, uReveal: sh.uReveal, uLight: sh.uLight, uGlow: ctx.U.glow, uTime: ctx.U.time },
          vertexShader: SH.STREAM_VS, fragmentShader: SH.STREAM_FS, transparent: true, depthWrite: false, side: DoubleSide }), 3);
        stream.visible = false;
      }
      glow = mesh(g, geo('quad', () => new PlaneGeometry(1, 1)), new ShaderMaterial(Object.assign({ uniforms: { uCol: lu.uEdge, uK: { value: 0 }, uGlow: ctx.U.glow }, vertexShader: SH.UV_VS, fragmentShader: SH.CAUSTIC_FS }, ADD)), -1);
      glow.rotation.x = -PI / 2; glow.scale.set(gr * 2.4, gr * 1.8, 1);
      liquid.userData.u = lu;
    }
    const glass = mesh(gG, geo('glass:' + spec.glass, () => turn(G.outer.concat(G.inner.slice().reverse()), 44)), mat(SH.GLASS_FS, { uTint: { value: new Color(.90, .95, .92) }, uDark: { value: 0 }, uInside: { value: new Color() }, uHasFill: { value: 0 }, uUp: { value: new Vector3(0, 1, 0) }, uFillD: { value: 0 } }, { depthWrite: false }), 5);
    mirror(mG, glass);

    function paint(t) { canvases.forEach((c) => { paintLabel(c.cv, t, Object.assign({ style: c.style }, look)); c.t.needsUpdate = true; }); }
    paint(text);

    let tris = 0; g.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });

    function update(pose, f) {
      const refl = f.refl > .02 && !f.holo;
      g.position.y = f.baseY;
      if (B) {
        let bx = spec.bottle[0], bz = spec.bottle[1];
        if (B.kind === 'tap') { B.pos.position.set(bx, B.half, bz); B.handle.rotation.z = -pose.tilt * .55; B.yaw.rotation.y = 0; }
        else {
          const tp = spec.source === 'bottle' ? tiltPose(spec, pose.tilt) : { x: bx, y: B.half, z: bz, angle: 0 };
          B.pos.position.set(tp.x, tp.y, tp.z); B.tilt.rotation.z = -tp.angle; bx = tp.x; bz = tp.z; B.mouth = tp.mouth;
          const face = Math.atan2(f.cx - (f.wx + bx), f.cz - (f.wz + bz)) * (1 - pose.tilt) + f.yaw; B.yaw.rotation.y = face;
          if (B.glassU) { const s = Math.sin(tp.angle), c = Math.cos(tp.angle), V = B.V; B.glassU.uUp.value.set(-s * Math.cos(face), c, -s * Math.sin(face));
            B.glassU.uFillD.value = (V.fill * CM / 2) * c + (V.r * CM * .45) * (1 - c * c) + (V.fill * CM / 2) * c * c; }      // the wine stays level while the bottle leans
          B.mYaw.position.set(spec.bottle[0], 0, spec.bottle[1]); B.mYaw.rotation.y = face;
        }
        B.mYaw.visible = refl && pose.tilt < .03;
        B.shadow.position.x = bx; B.shadow.position.z = bz; B.shadow.material.uniforms.uK.value = (f.holo ? 0 : .5) * sh.uReveal.value * (1 - .65 * pose.tilt);
      }
      mG.visible = refl; gShadow.material.uniforms.uK.value = (f.holo ? 0 : .34) * sh.uReveal.value;
      if (liquid) {
        const lu = liquid.userData.u, lv = y0 + (G.fill - y0) * pose.level, foamCm = headCm * pose.foam, on = pose.fade > .01 && (pose.level > .004 || foamCm > .02);
        lu.uLevel.value = f.baseY + lv * CM; lu.uFoam.value = foamCm * CM; lu.uWob.value.set(pose.wobble * .05, pose.wobble * .02); lu.uAt.value.set(f.wx + spec.glassAt[0], 0, f.wz + spec.glassAt[1]); lu.uAlpha.value = pose.fade;
        lu.uFoamy.value = Math.min(1, foamCm / .25);
        liquid.visible = on; top.visible = on; top.position.y = (lv + foamCm) * CM; top.scale.setScalar(radiusAt(G.inner, lv + foamCm) * CM * .98); top.rotation.z = -pose.wobble * .05; top.rotation.x = pose.wobble * .02;
        if (bubbles) { const k = pose.bubbles * pose.fade; bubbles.visible = k > .01 && pose.level > .05; bubbles.material.uniforms.uOn.value = k; bubbles.material.uniforms.uBase.value = (y0 + .3) * CM; bubbles.material.uniforms.uTop.value = lv * CM; bubbles.material.uniforms.uR.value = radiusAt(G.inner, lv) * CM * .8; }
        if (stream) {
          const u = stream.material.uniforms, flowing = pose.head > 0 && pose.tail < 1; stream.visible = flowing;
          if (flowing) {
            if (spec.source === 'tap') u.uA.value.set(spec.bottle[0] + B.spoutAt[0], B.spoutAt[1], spec.bottle[1]);
            else if (spec.source === 'bottle' && B && B.mouth) u.uA.value.set(B.mouth[0], B.mouth[1] - .02, B.mouth[2]);
            else u.uA.value.set(spec.glassAt[0], G.h * CM + 4.4, spec.glassAt[1]);
            u.uB.value.set(spec.glassAt[0] + (spec.source === 'bottle' ? .03 : 0), Math.max(lv, y0 + .2) * CM, spec.glassAt[1]); u.uHead.value = pose.head; u.uTail.value = pose.tail;
          }
        }
        glow.position.set(spec.glassAt[0] + gr * .55, .008, spec.glassAt[1] - gr * .35); glow.material.uniforms.uK.value = (f.holo ? 0 : .07) * pose.level * pose.fade * sh.uReveal.value * sh.uLight.value;      // away from the lamp, and faint
      }
    }
    function dispose() { live--; texs.forEach((t) => t.dispose()); keys.forEach(drop); keys.length = 0; }
    return { group: g, shared: sh, update, paint, tris: Math.round(tris), dispose, spec };
  }
  return { build, stats: () => ({ drinks: live, geometries: geos.size }) };
}
