#!/usr/bin/env python3
"""Work-in-progress sheet, larger: python3 tools/drawn/look.py out.jpg id id id ...  (previews on the thumbnail tile)"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from stocklib import STOCK, TILE   # noqa: E402
D = os.path.join(STOCK, '.scratch', 'drawn', 'preview')
out, ids = sys.argv[1], sys.argv[2:]
S = 480; cols = min(4, len(ids)); F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
sh = Image.new('RGB', (cols * S, -(-len(ids) // cols) * S), (12, 12, 12)); dr = ImageDraw.Draw(sh)
for k, i in enumerate(ids):
    im = Image.open(os.path.join(D, i + '.png')).convert('RGBA').resize((S, S), Image.LANCZOS)
    t = Image.new('RGB', (S, S), TILE); t.paste(im, (0, 0), im); sh.paste(t, ((k % cols) * S, (k // cols) * S))
    dr.text(((k % cols) * S + 6, (k // cols) * S + 4), i, fill=(255, 220, 120), font=F)
sh.save(out, quality=90)
