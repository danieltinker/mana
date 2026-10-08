"""Glue between the browser worker and pipeline.py (which is Halom's Python pipeline, unchanged).

pipeline.py expects onnxruntime sessions. In the browser the two models run in onnxruntime-web, which is
asynchronous, while pipeline.py is synchronous. So inference is done by *replay*: pipeline.run_matte / run_depth
are called with a stand-in session that answers from results already computed in JS; when it is asked for a
result it does not have, it raises Need carrying the input tensor. The worker runs that tensor through
onnxruntime-web, hands the output back, and calls again. Every number other than the network outputs is
therefore computed by the same Python, numpy, OpenCV and Pillow code as on the server.
"""
import gc
import hashlib
import io
import os
import sys
import types

# pipeline.py imports onnxruntime at the top; it is never used here (see _Replay)
sys.modules.setdefault('onnxruntime', types.ModuleType('onnxruntime'))

import numpy as np
from PIL import Image, ImageOps

import pipeline as P

OUT = '/tmp/halom-out'
MAX_SIDE = 1280
BIG_PIXELS = 20_000_000          # above this a JPEG is decoded at reduced size to keep memory down on phones
MAX_PIXELS = 120_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class Need(Exception):
    def __init__(self, kind, x):
        self.kind, self.x = kind, x


class _Replay:
    def __init__(self, kind, results):
        self.kind, self.results, self.i = kind, results, 0

    def get_inputs(self):
        return [types.SimpleNamespace(name='x')]

    def run(self, _outputs, feeds):
        x = next(iter(feeds.values()))
        if self.i < len(self.results):
            self.i += 1
            return [self.results[self.i - 1]]
        raise Need(self.kind, np.ascontiguousarray(x, dtype=np.float32))


_replay = {}
P._session = lambda name: _replay[name]


class Job:
    __slots__ = ('img', 'a', 'd', 'res_m', 'res_d', 'need')

    def __init__(self, img):
        self.img, self.a, self.d, self.res_m, self.res_d, self.need = img, None, None, [], [], None


_job = None                      # the one photo held in memory


def _bytes(x):
    if hasattr(x, 'to_bytes') and not isinstance(x, (bytes, int)):
        return x.to_bytes()                                  # a JS typed array
    return x.to_py().tobytes() if hasattr(x, 'to_py') else bytes(x)


def open_photo(data):
    """Decode exactly as pipeline.load_photo does. Returns None if Pillow cannot read the file
    (the worker then tries the browser's own decoder, e.g. for HEIC)."""
    global _job
    raw = _bytes(data)
    info = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    try:
        with Image.open(io.BytesIO(raw)) as im:
            w, h = im.size
            fmt = im.format
            if im.getexif().get(0x0112) in (5, 6, 7, 8):
                w, h = h, w
            if w * h > MAX_PIXELS:
                return {'error': 'too_large', **info}
            if w * h > BIG_PIXELS and fmt == 'JPEG':
                # not the reference path: the JPEG decoder scales while decoding (1/2, 1/4, 1/8)
                im.draft('RGB', (MAX_SIDE * 2, MAX_SIDE * 2))
                im = ImageOps.exif_transpose(im).convert('RGB')
                k = MAX_SIDE / max(im.size)
                if k < 1:
                    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
                img = np.array(im)
                info['decoder'] = 'pillow-draft'
            else:
                img = None
        if img is None:
            img = P.load_photo(io.BytesIO(raw), MAX_SIDE)
            info['decoder'] = 'pillow'
    except Image.DecompressionBombError:
        return {'error': 'too_large', **info}
    except Exception as e:                                   # not an image Pillow knows
        return {'error': 'undecodable', 'detail': type(e).__name__ + ': ' + str(e)[:200], **info}
    del raw
    _job = Job(np.ascontiguousarray(img))
    info.update(width=int(w), height=int(h), work_width=int(img.shape[1]), work_height=int(img.shape[0]), format=fmt)
    return info


def open_rgba(data, w, h, src_w, src_h, sha256, nbytes):
    """A photo the browser decoded (already turned and scaled to at most MAX_SIDE)."""
    global _job
    rgba = np.frombuffer(_bytes(data), np.uint8).reshape(int(h), int(w), 4)
    _job = Job(np.ascontiguousarray(rgba[..., :3]))
    return {'sha256': sha256, 'bytes': int(nbytes), 'decoder': 'browser', 'width': int(src_w), 'height': int(src_h),
            'work_width': int(w), 'work_height': int(h), 'format': None}


def step():
    """Advance the analysis of the photo in memory. Returns None when matte and depth are both done,
    else [kind, call_index, shape] and keeps the input tensor for take_input()."""
    j = _job
    j.need = None
    try:
        if j.a is None:
            _replay[P.MATTE_MODEL] = _Replay('matte', j.res_m)
            j.a = P.run_matte(j.img)
            j.res_m = []
        if j.d is None:
            _replay[P.DEPTH_MODEL] = _Replay('depth', j.res_d)
            j.d = P.run_depth(j.img)
            j.res_d = []
    except Need as n:
        j.need = n.x
        return [n.kind, len(j.res_m if n.kind == 'matte' else j.res_d), list(n.x.shape)]
    gc.collect()
    return None


def take_input():
    x, _job.need = _job.need, None
    return memoryview(x.reshape(-1))


def feed(kind, data, shape):
    arr = np.frombuffer(_bytes(data), np.float32).reshape([int(s) for s in shape]).copy()
    (_job.res_m if kind == 'matte' else _job.res_d).append(arr)


def pack():
    """The analysed photo as one block of bytes (photo, matte, depth), so the worker can park it outside
    this heap and bring it back for build()."""
    j = _job
    return j.img.tobytes() + j.a.astype(np.float32).tobytes() + j.d.astype(np.float32).tobytes()


def unpack(data, w, h):
    global _job
    w, h = int(w), int(h)
    buf = _bytes(data)
    n = w * h
    j = Job(np.frombuffer(buf, np.uint8, n * 3).reshape(h, w, 3).copy())
    j.a = np.frombuffer(buf, np.float32, n, n * 3).reshape(h, w).copy()
    j.d = np.frombuffer(buf, np.float32, n, n * 7).reshape(h, w).copy()
    _job = j


def drop():
    global _job
    _job = None
    gc.collect()


def _read(name):
    p = os.path.join(OUT, name)
    with open(p, 'rb') as f:
        b = f.read()
    os.remove(p)
    return b


def build(relief, angle, name, debug):
    """pipeline.build on the photo in memory. Returns the encoded files and the numbers."""
    j = _job
    if hasattr(angle, 'to_py'):
        angle = angle.to_py()
    if isinstance(angle, list):
        angle = tuple(float(v) for v in angle)
    try:
        meta, kind = P.build(j.img, j.a, j.d, OUT, 'o', relief=relief, angle=angle, name=name or '', debug=bool(debug))
    except ValueError as e:
        if str(e).startswith('No dish found'):
            return {'error': 'no_dish', 'message': str(e)}
        raise
    m = {'e': float(meta['e']), 'h': float(meta['h'])}
    if 'o' in meta:
        m['o'] = [float(v) for v in meta['o']]
        m['s'] = float(meta['s'])
    if 'warn' in meta:
        m['warn'] = str(meta['warn'])
    out = {'kind': kind, 'meta': m, 'color': _read('o.jpg'), 'aux': _read('o.png'), 'thumb': _read('o_t.jpg'),
           'debug': _read('o_dbg.jpg') if debug else None}
    gc.collect()
    return out


def versions():
    import cv2
    import PIL
    return {'python': sys.version.split()[0], 'numpy': np.__version__, 'opencv': cv2.__version__, 'pillow': PIL.__version__}
