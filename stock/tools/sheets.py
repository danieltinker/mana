#!/usr/bin/env python3
"""Contact sheets for review, written to sheets/:
  all.jpg       every entry's thumbnail with its id and where it comes from, in picker order
  drawn.jpg     the entries drawn in code, large: colour on the thumbnail tile beside a hologram-tint mock
  rejected.jpg  the base reliefs that were left out, each with the reason
Run from stock/:  python3 tools/sheets.py"""
import json, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from stocklib import STOCK, IMG, TILE, catalog, holo_mock

OUT = os.path.join(STOCK, 'sheets')
BASE = os.path.join(STOCK, '..', 'base')
F = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', s)
BG, INK, DIM, GOLD = (14, 13, 12), (236, 232, 224), (150, 146, 138), (255, 214, 120)

# why each base relief that is not in the library was left out (the reliefs are listed in base/assets.js; none shows a brand, a logo or text)
WHY = {
    'same': 'another picture stands for this dish',
    'own': 'too particular to stand for a type',
    'room': 'left out to keep the folder under 9 MB',
}
REJECTED = {
    'koko-neko-1': 'same', 'koko-neko-2': 'same', 'koko-neko-4': 'own', 'koko-neko-5': 'own', 'koko-neko-6': 'own', 'koko-neko-9': 'room',
    'abu-hassan-1': 'same', 'abu-hassan-2': 'own', 'abu-hassan-5': 'own', 'abu-hassan-8': 'own',
    'pizza-lila-1': 'own', 'pizza-lila-2': 'own', 'pizza-lila-3': 'same', 'pizza-lila-4': 'own', 'pizza-lila-5': 'same', 'pizza-lila-6': 'room', 'pizza-lila-8': 'same', 'pizza-lila-9': 'same',
    'yaffa-knafeh-1': 'same', 'yaffa-knafeh-2': 'same', 'yaffa-knafeh-3': 'own', 'yaffa-knafeh-4': 'own', 'yaffa-knafeh-5': 'room', 'yaffa-knafeh-7': 'own',
    'busi-0': 'same', 'busi-2': 'own', 'busi-4': 'own', 'busi-5': 'own', 'busi-7': 'same', 'busi-9': 'own',
    'hadayagim-0': 'same', 'hadayagim-1': 'same', 'hadayagim-4': 'same', 'hadayagim-7': 'same',
    'juno-1': 'own', 'juno-2': 'room', 'juno-3': 'same', 'juno-4': 'own', 'juno-8': 'own',
    'thai-sinai-0': 'own', 'thai-sinai-2': 'own', 'thai-sinai-3': 'own', 'thai-sinai-4': 'own', 'thai-sinai-5': 'same', 'thai-sinai-6': 'own', 'thai-sinai-7': 'same', 'thai-sinai-9': 'same',
    'cafe-shneor-6': 'room', 
    'pizza-lila-7': 'room', 'thai-sinai-8': 'room', 'juno-0': 'own', 'cafe-shneor-1': 'room',
    'hamburger-26-1': 'own', 'hamburger-26-2': 'same', 'hamburger-26-3': 'same', 'hamburger-26-4': 'same', 'hamburger-26-5': 'same', 'hamburger-26-7': 'same',
}


def cut(color, aux, size):
    c = Image.open(color).convert('RGB').resize((size, size), Image.LANCZOS)
    a = Image.open(aux).convert('RGB').split()[1].resize((size, size), Image.LANCZOS)
    t = Image.new('RGB', (size, size), TILE); t.paste(c, (0, 0), a)
    return t, c, a


def sheet_all(man):
    S, LAB, COLS = 150, 34, 10
    items = man['items']; rows = -(-len(items) // COLS)
    sh = Image.new('RGB', (COLS * S, rows * (S + LAB) + 30), BG); d = ImageDraw.Draw(sh)
    d.text((8, 7), 'Mana placeholder library: %d entries (%d from Halom\'s reliefs, %d drawn in code). Thumbnails as shipped.' % (len(items), sum(e['src'] == 'base' for e in items), sum(e['src'] == 'drawn' for e in items)), fill=INK, font=F(14))
    for k, e in enumerate(items):
        x, y = (k % COLS) * S, 30 + (k // COLS) * (S + LAB)
        sh.paste(Image.open(os.path.join(STOCK, e['thumb'])).convert('RGB').resize((S - 6, S - 6), Image.LANCZOS), (x + 3, y + 3))
        d.text((x + 5, y + S), e['id'], fill=INK, font=F(12))
        d.text((x + 5, y + S + 15), '%s · %s' % (e['src'], e['kind']), fill=GOLD if e['src'] == 'drawn' else DIM, font=F(11))
    sh.save(os.path.join(OUT, 'all.jpg'), quality=72, optimize=True)


def sheet_drawn(man):
    S, LAB, COLS = 280, 22, 3
    items = [e for e in man['items'] if e['src'] == 'drawn']; rows = -(-len(items) // COLS); W = 2 * S + 10
    sh = Image.new('RGB', (COLS * W, rows * (S + LAB) + 30), BG); d = ImageDraw.Draw(sh)
    d.text((8, 7), 'Drawn in code (%d): colour on the thumbnail tile · hologram-tint mock (the viewer\'s tint, scan lines and lit rim, flat)' % len(items), fill=INK, font=F(14))
    for k, e in enumerate(items):
        x, y = (k % COLS) * W, 30 + (k // COLS) * (S + LAB)
        t, c, a = cut(os.path.join(STOCK, e['color']), os.path.join(STOCK, e['aux']), S)
        sh.paste(t, (x, y)); sh.paste(holo_mock(np.asarray(c), np.asarray(a)), (x + S, y))
        d.text((x + 5, y + S + 3), '%s · %s · e %g · h %g%s' % (e['id'], e['kind'], e['e'], e['h'], ' · s %g' % e['s'] if e['s'] else ''), fill=INK, font=F(12))
    sh.save(os.path.join(OUT, 'drawn.jpg'), quality=70, optimize=True)


def sheet_rejected():
    used = {e['from'] for e in catalog()['entries'] if e['src'] == 'base'}
    with open(os.path.join(BASE, 'assets.js'), encoding='utf8') as f:
        ids = list(json.loads(re.search(r'=\s*(\{.*\})\s*;', f.read(), re.S).group(1)))
    left = [i for i in ids if i not in used]
    missing = [i for i in left if i not in REJECTED]
    assert not missing, 'no reason given for: ' + ', '.join(missing)
    S, LAB, COLS = 116, 34, 10
    rows = -(-len(left) // COLS)
    sh = Image.new('RGB', (COLS * S, rows * (S + LAB) + 30), BG); d = ImageDraw.Draw(sh)
    d.text((8, 7), 'Base reliefs left out: %d of %d   ·   same = %s   ·   own = %s   ·   room = %s' % (len(left), len(ids), WHY['same'], WHY['own'], WHY['room']), fill=INK, font=F(12))
    for k, i in enumerate(left):
        x, y = (k % COLS) * S, 30 + (k // COLS) * (S + LAB)
        t, _, _ = cut(os.path.join(BASE, 'img', i + '.jpg'), os.path.join(BASE, 'img', i + '.png'), S - 6)
        sh.paste(t, (x + 3, y + 3))
        d.text((x + 5, y + S), i, fill=INK, font=F(11)); d.text((x + 5, y + S + 14), REJECTED[i], fill=GOLD, font=F(11))
    sh.save(os.path.join(OUT, 'rejected.jpg'), quality=70, optimize=True)
    return len(left)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    man = json.load(open(os.path.join(STOCK, 'stock.json'), encoding='utf8'))
    sheet_all(man); sheet_drawn(man); n = sheet_rejected()
    print('sheets written:', ', '.join('%s %d KB' % (f, os.path.getsize(os.path.join(OUT, f)) // 1024) for f in sorted(os.listdir(OUT))), '· rejected', n)
