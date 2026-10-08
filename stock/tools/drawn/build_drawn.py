#!/usr/bin/env python3
"""Turns the renders of the objects drawn in code into placeholder entries: the same three files a relief has.

  node tools/drawn/render.mjs            -> .scratch/drawn/<id>_c.png (colour), <id>_d.png (height + coverage), <id>.json
  python3 tools/drawn/build_drawn.py     -> img/<id>.jpg (768 px), img/<id>.png (512 px, R = height, G = matte), img/<id>_t.jpg, stock.json

Dishes on a plate get an exact height: the renderer writes, for every pixel, how far the visible surface is from the table
along the view axis, which is what the viewer's relief shader expects (base/engine.js DISH_VS: p = (x, h sin e, -y / sin e + h cos e)).
Standing drinks (glasses, bottles) get the photo pipeline's own shape instead (gen/pipeline.py, relief 'stand'): an upright
shell, round in cross-section, built from the outline, pivoting on the foot. The exact surface of a glass seen from above
tears when the viewer turns it 55 degrees; the shell does not, and it is how every photographed drink is built.
As in the pipeline the height of the nearest inside pixel is carried outward past the outline, so the matte alone cuts the
shape, and the colours at the edge are bled outward so the matte never shows backdrop.
Only entries listed in tools/catalog.json with "src": "drawn" are built; an entry whose render is missing is reported and left out.
"""
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from stocklib import STOCK, IMG, catalog, manifest_item, write_thumb, write_manifest   # noqa: E402

SRC = os.environ.get('STOCK_RENDERS', os.path.join(STOCK, '.scratch', 'drawn'))
SIZE, ZSIZE = 768, 512
STAND_SCALE = 27.6          # cm of crop side that make s = 1: a 17 cm crop (a tall glass) gets the pipeline's 0.62


def stand_shell(hard, elev):
    """gen/pipeline.py's standing drink, line for line: a pixel v above the base line that bulges b toward the camera sits
    (v / sin e + b) / cos e along the view axis. Returns heights in units of the crop's side and the pivot in pixels."""
    H, W = hard.shape
    e = math.radians(elev)
    ys, xs = np.where(hard > 0)
    y0, y1 = ys.min(), ys.max()
    foot = hard[int(y1 - .08 * (y1 - y0)):y1 + 1]
    fx = np.where(foot.any(0))[0]
    px, py = (fx.min() + fx.max()) / 2.0, y1 - .25 * (fx.max() - fx.min()) * math.sin(e)
    bul = np.zeros((H, W), np.float32)
    for r in range(y0, y1 + 1):
        edges = np.flatnonzero(np.diff(np.concatenate([[0], hard[r], [0]])))
        for a0, a1 in zip(edges[::2], edges[1::2]):
            R = (a1 - a0) / 2.0
            xc = (a0 + a1 - 1) / 2.0
            bul[r, a0:a1] = np.sqrt(np.clip(R * R - (np.arange(a0, a1) - xc) ** 2, 0, None))
    bul = cv2.GaussianBlur(bul, (0, 0), 2.5)
    yy = np.mgrid[0:H, 0:W][0].astype(np.float64)
    h = ((py - yy) / math.sin(e) + .85 * bul) / math.cos(e) / W
    return np.clip(h, 0, None).astype(np.float32), (px, py)


def build_one(sid):
    meta = json.load(open(os.path.join(SRC, sid + '.json')))
    c = np.asarray(Image.open(os.path.join(SRC, sid + '_c.png')).convert('RGBA'), np.float32) / 255
    d = np.asarray(Image.open(os.path.join(SRC, sid + '_d.png')).convert('RGBA'), np.float32)
    side_cm = meta['win'][2] * 2
    # colour: average the 2x2 samples weighted by coverage, then fill everything outside with the nearest inside colour
    n = c.shape[0] // SIZE
    a = c[..., 3:4]
    pm = (c[..., :3] * a).reshape(SIZE, n, SIZE, n, 3).mean((1, 3))
    al = a.reshape(SIZE, n, SIZE, n).mean((1, 3))
    rgb = pm / np.maximum(al[..., None], 1e-4)
    core = (al > .6).astype(np.uint8)
    _, near = cv2.distanceTransformWithLabels(1 - core, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    lut = np.zeros((int(near.max()) + 1, 3), np.float32)
    lut[near[core > 0]] = rgb[core > 0]
    bled = lut[near]
    soft = cv2.GaussianBlur(bled, (0, 0), 2.0)
    out = np.where(core[..., None] > 0, rgb, np.where((al > .02)[..., None], bled, soft))
    Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8)).save(os.path.join(IMG, sid + '.jpg'), quality=86, optimize=True)

    # height along the view axis in units of the crop's side; coverage is the matte
    hh = (d[..., 0] * 256 + d[..., 1]) / 65535 * meta['henc'] * (65535 / 65280) / side_cm
    cov = d[..., 2] / 255
    hard = (cov > .5).astype(np.uint8)
    pivot = None
    if meta.get('stand'):
        hh, pivot = stand_shell(hard, float(meta['e']))
    er = cv2.erode(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    solid = er if er.sum() > 50 else hard
    _, near = cv2.distanceTransformWithLabels((solid == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    lut = np.zeros(int(near.max()) + 1, np.float32)
    lut[near[solid > 0]] = hh[solid > 0]
    # the depth net's reliefs are soft; a sheer drop (the side of a cup above its saucer) streaks when the dish is turned, a slope does not
    h = cv2.GaussianBlur(lut[near], (0, 0), 2.5 if pivot else 5.5)
    k = d.shape[0] // ZSIZE
    h = h.reshape(ZSIZE, k, ZSIZE, k).mean((1, 3))
    al5 = cov.reshape(ZSIZE, k, ZSIZE, k).mean((1, 3))
    hmax = float(max(.02, np.percentile(h[al5 > .6], 99.8)))
    aux = np.zeros((ZSIZE, ZSIZE, 3), np.uint8)
    aux[..., 0] = (np.clip(h / hmax, 0, 1) * 255 + .5).astype(np.uint8)
    aux[..., 1] = (np.clip(al5, 0, 1) * 255 + .5).astype(np.uint8)
    Image.fromarray(aux).save(os.path.join(IMG, sid + '.png'), optimize=True, compress_level=9)
    write_thumb(sid)
    m = {'e': float(meta['e']), 'h': round(hmax, 4), 'o': None, 's': None}
    if pivot:                                                   # where it stands, as the pipeline writes it; s keeps real sizes true to each other
        m['o'] = [round(pivot[0] / d.shape[1] - .5, 4), round(.5 - pivot[1] / d.shape[0], 4)]
        m['s'] = meta.get('s') or round(min(.8, max(.3, side_cm / STAND_SCALE)), 2)
    return m


def build(only=None):
    os.makedirs(IMG, exist_ok=True)
    items, missing = [], []
    for e in catalog()['entries']:
        if e['src'] != 'drawn' or (only and e['id'] not in only):
            continue
        if not os.path.exists(os.path.join(SRC, e['id'] + '.json')):
            missing.append(e['id'])
            continue
        items.append(manifest_item(e, build_one(e['id'])))
    if only:                                                    # a partial run keeps the other drawn entries as they are
        path = os.path.join(STOCK, 'stock.json')
        old = [x for x in json.load(open(path, encoding='utf8'))['items'] if x.get('src') == 'drawn' and x['id'] not in only] if os.path.exists(path) else []
        items = old + items
    out = write_manifest(items, 'drawn')
    print(len(items), 'drawn,', len(out['items']), 'entries in stock.json' + (' · no render for: ' + ', '.join(missing) if missing else ''))


if __name__ == '__main__':
    build(set(sys.argv[1:]) or None)
