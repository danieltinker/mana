#!/usr/bin/env python3
"""Looking sheet for work in progress: each preview on the thumbnail tile, small as in a list, and as a hologram-tint mock.
python3 tools/drawn/preview_sheet.py [ids...]  ->  .scratch/drawn/preview/_sheet.jpg"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from stocklib import STOCK, TILE, holo_mock   # noqa: E402
D = os.path.join(STOCK, '.scratch', 'drawn', 'preview')
ids = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(D) if f.endswith('.png'))
S = 400; F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
cols = 2 if len(ids) <= 4 else 3 if len(ids) <= 9 else 4
W = S * 2 + 110
sh = Image.new('RGB', (cols * W, -(-len(ids) // cols) * (S + 4)), (12, 12, 12)); dr = ImageDraw.Draw(sh)
for k, i in enumerate(ids):
    im = Image.open(os.path.join(D, i + '.png')).convert('RGBA').resize((S, S), Image.LANCZOS)
    x, y = (k % cols) * W, (k // cols) * (S + 4)
    t = Image.new('RGB', (S, S), TILE); t.paste(im, (0, 0), im); sh.paste(t, (x, y))
    a = np.asarray(im)
    sh.paste(holo_mock(a[..., :3], a[..., 3]), (x + S, y))
    sm = t.resize((96, 96), Image.LANCZOS); sh.paste(sm, (x + 2 * S + 7, y + 8))
    sm2 = holo_mock(a[..., :3], a[..., 3], size=96); sh.paste(sm2, (x + 2 * S + 7, y + 112))
    dr.text((x + 6, y + 4), i, fill=(255, 220, 120), font=F)
sh.save(os.path.join(D, '_sheet.jpg'), quality=90)
print(sh.size)
