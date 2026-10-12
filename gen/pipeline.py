"""Dish photo -> hologram assets. Runs on CPU with two open models, no paid service.

In:  one photo of one dish (any size). Best: shot from about 45 degrees, whole dish in frame, plain background.
Out: <id>.jpg   colour, square crop around the dish, edge colours bled outward
     <id>.png   R = height above the table (0..255 over meta['h']), G = cut-out matte
     <id>_t.jpg small cut-out for lists
     meta       e = camera elevation in degrees, h = max height in units of the crop's side,
                and for standing drinks o = pivot offset, s = scale

Models (both fine for commercial work):
  u2net.onnx                    cut-out, Apache-2.0 (xuebinqin/U-2-Net)
  depth_anything_v2_vits.onnx   depth,   Apache-2.0 (Depth Anything V2 Small; the Base and Large models are non-commercial)
"""
import gc
import math
import os
import re
import threading

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.environ.get('MENU_STUDIO_MODELS', os.path.join(os.path.dirname(HERE), 'models'))
MATTE_MODEL = 'u2net.onnx'
DEPTH_MODEL = 'depth_anything_v2_vits.onnx'
MEAN = np.array([.485, .456, .406], np.float32)
STD = np.array([.229, .224, .225], np.float32)

# relief height in dish widths; 'stand' is built from the outline instead
RELIEF = {'flat': .07, 'low': .13, 'medium': .22, 'tall': .38}
ANGLES = {'low': 30.0, 'mid': 45.0, 'high': 60.0, 'top': 85.0}
GUESS = [
    ('stand', r'beer|wine|juice|lemonade|cocktail|mojito|negroni|spritz|soda|cola|water|bottle|pitcher|smoothie|milkshake|'
              r'בירה|יין|מיץ|לימונדה|קוקטייל|בקבוק|קנקן|שייק'),
    ('flat', r'pizza|hummus|humus|carpaccio|focaccia|labaneh|labneh|flatbread|masabacha|פיצה|חומוס|קרפצ|פוקצ|לבנה|מסבחה'),
    ('tall', r'burger|cake|sandwich|pancake|ramen|soup|bowl|pita|shawarma|ice cream|sundae|toast|'
             r'המבורגר|עוגה|עוגת|כריך|פנקייק|ראמן|מרק|פיתה|שווארמה|גלידה|טוסט'),
    ('low', r'salad|pasta|rice|fish|schnitzel|fries|omelette|סלט|פסטה|אורז|דג|שניצל|צ.יפס|חביתה'),
]

_sessions = {}
_lock = threading.Lock()


def models_ready():
    return all(os.path.exists(os.path.join(MODELS_DIR, m)) for m in (MATTE_MODEL, DEPTH_MODEL))


def _session(name):
    if name not in _sessions:
        so = ort.SessionOptions()
        so.intra_op_num_threads = max(2, min(6, (os.cpu_count() or 4) - 1))
        so.enable_cpu_mem_arena = False
        _sessions[name] = ort.InferenceSession(os.path.join(MODELS_DIR, name), so, providers=['CPUExecutionProvider'])
    return _sessions[name]


def load_photo(path, max_side=1280):
    """RGB array, turned the way the phone meant it, no larger than max_side."""
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    if max(im.size) > max_side:
        k = max_side / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    return np.array(im)


def _matte_once(img):
    s = _session(MATTE_MODEL)
    x = cv2.resize(img, (320, 320), interpolation=cv2.INTER_AREA).astype(np.float32)
    x = x / max(float(x.max()), 1e-6)
    x = ((x - MEAN) / STD).transpose(2, 0, 1)[None].astype(np.float32)
    o = s.run(None, {s.get_inputs()[0].name: x})[0][0, 0]
    o = (o - o.min()) / (o.max() - o.min() + 1e-6)
    return cv2.resize(o.astype(np.float32), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)


def run_matte(img):
    """Cut-out in 0..1. Two passes: find the dish, then look again at just that part for a cleaner edge."""
    a = _matte_once(img)
    H, W = a.shape
    ys, xs = np.where(a > .5)
    if len(xs) < 80:
        return a
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    p = int(.12 * max(x1 - x0, y1 - y0))
    x0, y0, x1, y1 = max(0, x0 - p), max(0, y0 - p), min(W, x1 + p), min(H, y1 + p)
    if (x1 - x0) * (y1 - y0) > .85 * W * H:
        return a
    b = np.zeros_like(a)
    b[y0:y1, x0:x1] = _matte_once(np.ascontiguousarray(img[y0:y1, x0:x1]))
    return b


def run_depth(img):
    s = _session(DEPTH_MODEL)
    x = cv2.resize(img, (518, 518), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    x = ((x - MEAN) / STD).transpose(2, 0, 1)[None].astype(np.float32)
    d = s.run(None, {s.get_inputs()[0].name: x})[0].squeeze()
    return cv2.resize(d, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC).astype(np.float32)


def analyse(img):
    """The slow part (about 3 s on a laptop): matte and depth for one photo. Cache the result; build() is fast."""
    with _lock:
        a = run_matte(img)
        d = run_depth(img)
    gc.collect()
    return a, d


def guess_relief(name):
    t = (name or '').lower()
    for kind, pat in GUESS:
        if re.search(pat, t):
            return kind
    return 'medium'


def build(img, a, d, out_dir, did, relief='auto', angle='auto', name='', size=768, zsize=512, debug=False):
    """Turn photo + matte + depth into the three files. relief: auto | flat | low | medium | tall | stand.
    angle: auto | low | mid | high | top, or a number of degrees (the camera's height above the table)."""
    H, W = img.shape[:2]
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    b = max(6, int(.04 * W))
    border = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3), lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    bg = np.median(border, 0)
    spread_l = float(np.std(border[:, 0]))
    spread_c = float(np.std(np.hypot(border[:, 1] - bg[1], border[:, 2] - bg[2])))
    sal = (a > .5).astype(np.uint8)
    if spread_l < 16 and spread_c < 7:
        # a plain backdrop: anything clearly different from it and touching the dish is dish too
        # (catches white plates and metal trays the matte skips). Shadows are darker than a dark backdrop, so they stay out.
        dL = lab[..., 0] - bg[0]
        dC = np.hypot(lab[..., 1] - bg[1], lab[..., 2] - bg[2])
        key = ((dL > 22) | (dC > 16)) if bg[0] < 125 else (dC > 18)
        key = cv2.morphologyEx(key.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        _, lab0 = cv2.connectedComponents(((key | sal) > 0).astype(np.uint8), connectivity=8)
        touch = np.unique(lab0[sal > 0])
        touch = touch[touch > 0]
        keyed = np.isin(lab0, touch).astype(np.uint8)
        cnts = cv2.findContours(keyed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]
        filled = np.zeros_like(keyed)
        cv2.drawContours(filled, cnts, -1, 1, -1)
        a = np.maximum(a, cv2.GaussianBlur(filled.astype(np.float32), (0, 0), 1.0))
    hard = (a > .5).astype(np.uint8)
    if hard.sum() < 400:
        raise ValueError('No dish found in this photo. Use a photo where the dish is clear and whole.')
    n, lbl, st, _ = cv2.connectedComponentsWithStats(hard, 8)
    if n > 2:
        big = st[1:, cv2.CC_STAT_AREA].max()
        sel = np.zeros_like(hard)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] > .04 * big:
                sel[lbl == i] = 1
        hard = sel
    hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    core = cv2.erode(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    soft = np.clip((a - .15) / .7, 0, 1) * cv2.dilate(hard, np.ones((5, 5), np.uint8))
    alpha = np.minimum(soft, cv2.GaussianBlur(core.astype(np.float32), (0, 0), 1.2) * 1.6).clip(0, 1)
    ys, xs = np.where(hard > 0)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw = float(x1 - x0 + 1)
    bh = float(y1 - y0 + 1)

    if relief == 'auto':
        relief = guess_relief(name)
        if relief == 'stand' and bh / bw < 1.15:
            relief = 'medium'            # the name says drink, the outline says plate
        elif relief != 'stand' and bh / bw > 1.6:
            relief = 'stand'             # tall and narrow: a glass or a bottle
    if relief not in RELIEF and relief != 'stand':
        relief = 'medium'

    cnt = max(cv2.findContours(hard, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
    e_est = 45.0
    if len(cnt) >= 5:
        (_, _), (m1, m2), _ = cv2.fitEllipse(cv2.convexHull(cnt))
        e_est = math.degrees(math.asin(min(1.0, max(.2, min(m1, m2) / max(m1, m2, 1e-6)))))
    if relief == 'stand':
        elev = 45.0 if angle in ('auto', None) or isinstance(angle, (tuple, list)) else float(ANGLES.get(angle, angle))
        elev = float(np.clip(elev, 30, 60))      # a standing outline says nothing about the camera angle
    elif isinstance(angle, (tuple, list)):
        elev = float(np.clip(e_est, angle[0], angle[1]))
    elif angle in ('auto', None):
        elev = float(np.clip(e_est, 32, 85))     # a round plate looks like an ellipse: its squash gives the camera angle
    else:
        elev = float(np.clip(float(ANGLES.get(angle, angle)), 20, 90))
    e = math.radians(elev)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    stand = None
    if relief == 'stand':
        # upright shell, round in cross-section, straight from the outline: a pixel v above the base line
        # that bulges b toward the camera sits (v / sin e + b) / cos e along the view axis
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
        h = ((py - yy) / math.sin(e) + .85 * bul) / math.cos(e) / bw
        stand = (px, py)
    else:
        # height above the table: fit a plane to the depth of the background just outside the dish
        dd = cv2.bilateralFilter(d, 7, float(np.ptp(d)) * .06, 5).astype(np.float64)
        outside = cv2.distanceTransform(1 - hard, cv2.DIST_L2, 5)
        ring = (outside > .02 * bw) & (outside < .12 * bw)
        if ring.sum() < 200:
            ring = (outside > 2)
        if ring.sum() >= 50:
            X = np.stack([xx[ring], yy[ring], np.ones(int(ring.sum()))], 1)
            y = dd[ring]
            coef = np.linalg.lstsq(X, y, rcond=None)[0]
            r = y - X @ coef
            keep = np.abs(r) < 2.5 * (np.median(np.abs(r)) + 1e-9)
            if keep.sum() >= 30:
                coef = np.linalg.lstsq(X[keep], y[keep], rcond=None)[0]
            res = dd - (coef[0] * xx + coef[1] * yy + coef[2])
        else:
            res = dd - float(np.percentile(dd[hard > 0], 5))       # the dish fills the frame: no table to measure against
        inside = cv2.erode(hard, np.ones((5, 5), np.uint8)) > 0
        if not inside.any():
            inside = hard > 0
        top = float(np.percentile(res[inside], 99.5))
        if top <= 1e-6 or float(np.mean(res[inside] > .15 * top)) < .3:
            # the table estimate ended up above most of the dish (a deep bowl, a cluttered table): measure from the dish's own low point
            res = dd - float(np.percentile(dd[inside], 4))
            top = float(np.percentile(res[inside], 99.5))
        h = res / (top if top > 1e-6 else 1.0) * RELIEF[relief]
        h = cv2.GaussianBlur(h.astype(np.float32), (0, 0), 1.0)
    h = np.clip(h, 0, None).astype(np.float32)

    # no wall at the silhouette: carry the height of the nearest interior pixel outward, the matte alone cuts the edge
    er = max(5, int(.012 * bw)) | 1
    solid = cv2.erode(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (er, er)))
    if solid.sum() < 50:
        solid = hard
    _, near = cv2.distanceTransformWithLabels((solid == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    lut = np.zeros(int(near.max()) + 1, np.float32)
    lut[near[solid > 0]] = h[solid > 0]
    h = cv2.GaussianBlur(lut[near], (0, 0), 1.2)

    pad = int(.05 * max(x1 - x0, y1 - y0))
    side = int(max(x1 - x0, y1 - y0) + 2 * pad)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    L, T = int(cx - side // 2), int(cy - side // 2)

    def crop(arr):
        out = np.zeros((side, side) + arr.shape[2:], arr.dtype)
        sx0, sy0 = max(L, 0), max(T, 0)
        sx1, sy1 = min(L + side, W), min(T + side, H)
        out[sy0 - T:sy1 - T, sx0 - L:sx1 - L] = arr[sy0:sy1, sx0:sx1]
        return out

    rgb = crop(img)
    al = crop(alpha.astype(np.float32))
    hh = crop(h) * (bw / side)
    mk = crop(core)
    hmax = float(max(.02, np.percentile(hh[mk > 0], 99.8)))
    z = np.clip(hh / hmax, 0, 1)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    hole = ((mk == 0) * 255).astype(np.uint8)
    small = cv2.resize(bgr, (384, 384), interpolation=cv2.INTER_AREA)
    sh = cv2.resize(hole, (384, 384), interpolation=cv2.INTER_NEAREST)
    fill = cv2.resize(cv2.inpaint(small, sh, 4, cv2.INPAINT_TELEA), (side, side), interpolation=cv2.INTER_LINEAR)
    bgr = np.where(hole[..., None] > 0, fill, bgr)
    blur = cv2.GaussianBlur(bgr, (0, 0), 1.4)                # phone photos and resizes are a little soft
    bgr = cv2.addWeighted(bgr, 1.4, blur, -.4, 0)
    os.makedirs(out_dir, exist_ok=True)
    inter = cv2.INTER_AREA if side >= size else cv2.INTER_CUBIC
    cv2.imwrite(os.path.join(out_dir, did + '.jpg'), cv2.resize(bgr, (size, size), interpolation=inter), [cv2.IMWRITE_JPEG_QUALITY, 86])
    aux = np.zeros((side, side, 3), np.uint8)
    aux[..., 2] = (z * 255 + .5).astype(np.uint8)
    aux[..., 1] = (al * 255 + .5).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, did + '.png'), cv2.resize(aux, (zsize, zsize), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_PNG_COMPRESSION, 9])
    cut = (cv2.resize(bgr, (256, 256), interpolation=cv2.INTER_AREA).astype(np.float32) * cv2.resize(al, (256, 256))[..., None]
           + np.array([20, 21, 22], np.float32) * (1 - cv2.resize(al, (256, 256))[..., None]))
    cv2.imwrite(os.path.join(out_dir, did + '_t.jpg'), cut.astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 82])
    meta = {'e': round(elev, 1), 'h': round(hmax, 4)}
    edge = np.concatenate([hard[0], hard[-1], hard[:, 0], hard[:, -1]])
    warn = []
    if edge.mean() > .08:
        warn.append('The dish is cut off by the edge of the photo. A photo with the whole dish in frame looks better.')
    elif bw * bh < .1 * W * H:
        warn.append('The dish is small in this photo. A closer photo will look sharper.')
    if warn:
        meta['warn'] = warn[0]
    if stand:                                                # pivot where it stands, not the middle of the picture
        meta['o'] = [round((stand[0] - L) / side - .5, 4), round(.5 - (stand[1] - T) / side, 4)]
        meta['s'] = .62
    if debug:
        on = (cv2.resize(bgr, (512, 512)) * cv2.resize(al, (512, 512))[..., None]).astype(np.uint8)
        vis = np.hstack([on, cv2.applyColorMap(cv2.resize((z * 255).astype(np.uint8), (512, 512)), cv2.COLORMAP_INFERNO)])
        cv2.imwrite(os.path.join(out_dir, did + '_dbg.jpg'), vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return meta, relief


def accent_from_logo(path):
    """The logo's strongest colour, brightened: holograms need a bright hue. None if the logo is black and white."""
    im = np.array(ImageOps.exif_transpose(Image.open(path)).convert('RGBA').resize((64, 64)))
    px = im[im[..., 3] > 128][:, :3].astype(np.float32)
    if len(px) < 20:
        return None
    mx, mn = px.max(1), px.min(1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    px = px[(sat > .28) & (mx > 40)]
    if len(px) < 12:
        return None
    q = (px // 32).astype(np.int32)
    keys = q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2]
    best = np.bincount(keys).argmax()
    c = px[keys == best].mean(0)
    c = c * (235 / max(float(c.max()), 1))
    return '#%02x%02x%02x' % tuple(int(min(255, max(0, v))) for v in c)
