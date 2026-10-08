#!/usr/bin/env python3
"""Two contact sheets of the main path, old app next to new: .shots/v2/before.jpg and .shots/v2/after.jpg.

before: screenshots of the old app (branch master) taken by `WORDS_SHOTS=.scratch/words-shots node test/words.mjs`
after:  the screenshot tour of this branch (`node test/shots.mjs`) in .shots/v2/ (the publish step is taken from
        .shots/v2/with-viewer-v2/ when that folder exists: the same tour run against the current ../view and ../stock)
Both at 390 x 844, Hebrew, the first screenful of each step. The number under a step is its count of visible interface
words (test/.out/words.json), where the step was counted.

    python3 tools/contact-sheets.py
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, '.shots', 'v2')
OLD = os.path.join(ROOT, '.scratch', 'words-shots')
W, H, SCALE = 390, 844, 0.72
TW, TH = round(W * SCALE), round(H * SCALE)
GAP, PAD, CAP, HEAD = 22, 36, 58, 92
BG, INK, MUTED, EDGE = (246, 241, 238), (15, 15, 15), (110, 96, 90), (222, 211, 205)


def font(size, bold=False):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def words():
    try:
        with open(os.path.join(ROOT, 'test', '.out', 'words.json'), encoding='utf8') as f:
            data = json.load(f)
        return {'v1': {r['screen']: r['ui'] for r in data['before']}, 'v2': {r['screen']: r['ui'] for r in data['after']}}
    except (OSError, ValueError, KeyError):
        return {'v1': {}, 'v2': {}}


def old_shot(screen):
    """The old app's screenshot for a counted screen (files are named v1-NN-<screen>.png)."""
    slug = ''.join(c if c.isalnum() else '-' for c in screen)
    while '--' in slug:
        slug = slug.replace('--', '-')
    for name in sorted(os.listdir(OLD)) if os.path.isdir(OLD) else []:
        if name.startswith('v1-') and name[6:-4] == slug:
            return os.path.join(OLD, name)
    return None


def sheet(title, note, steps, path, per_row):
    rows = (len(steps) + per_row - 1) // per_row
    width = PAD * 2 + per_row * TW + (per_row - 1) * GAP
    height = HEAD + PAD + rows * (TH + CAP) + (rows - 1) * GAP + PAD
    img = Image.new('RGB', (width, height), BG)
    d = ImageDraw.Draw(img)
    d.text((PAD, 26), title, font=font(30, True), fill=INK)
    d.text((PAD, 66), note, font=font(17), fill=MUTED)
    for i, (label, file, count) in enumerate(steps):
        x = PAD + (i % per_row) * (TW + GAP)
        y = HEAD + PAD + (i // per_row) * (TH + CAP + GAP)
        if file and os.path.exists(file):
            shot = Image.open(file).convert('RGB')
            shot = shot.crop((0, 0, min(W, shot.width), min(H, shot.height)))
            if shot.size != (W, H):                      # a short page: pad with the page colour
                full = Image.new('RGB', (W, H), shot.getpixel((2, 2)))
                full.paste(shot, (0, 0))
                shot = full
            img.paste(shot.resize((TW, TH), Image.LANCZOS), (x, y))
        else:
            d.rectangle([x, y, x + TW, y + TH], fill=(235, 228, 224))
            d.text((x + 16, y + 16), 'missing', font=font(16), fill=MUTED)
        d.rectangle([x, y, x + TW - 1, y + TH - 1], outline=EDGE, width=1)
        d.text((x, y + TH + 10), f'{i + 1}. {label}', font=font(17, True), fill=INK)
        if count is not None:
            d.text((x, y + TH + 33), f'{count} words', font=font(15), fill=MUTED)
    os.makedirs(OUT, exist_ok=True)
    img.save(path, quality=86, optimize=True)
    print(os.path.relpath(path, ROOT), img.size)


def main():
    n = words()
    v1 = lambda screen, label: (label, old_shot(screen), n['v1'].get(screen))
    new = lambda file, label, screen=None: (label, os.path.join(OUT, file), n['v2'].get(screen) if screen else None)
    before = [
        v1('start', 'Sign in'), v1('start: new account', 'New account (second tab)'),
        v1('set-up 1: name', 'Set-up 1: name'), v1('set-up 2: address', 'Set-up 2: address'),
        v1('set-up 3: contact', 'Set-up 3: contact'), v1('set-up 4: check', 'Set-up 4: check'),
        v1('home before publishing', 'Home: a list of steps'), v1('menu, empty', 'Menu, empty'),
        v1('menu', 'Menu'), v1('one dish', 'One dish (a page)'), v1('pictures', 'Pictures'),
        v1('look', 'Look'), v1('preview', 'Preview (a page)'), v1('publish', 'Publish'),
        v1('published', 'Published'), v1('home after publishing', 'Home: the steps stay'),
    ]
    after = [
        new('01-start-he.png', 'Start', 'start'), new('02-name-he.png', 'The place', 'set-up'),
        new('03-menu-empty-he.png', 'Menu: three ways in', 'menu, empty'), new('04-scan-reading-he.png', 'Scanning the photo'),
        new('05-scan-review-he.png', 'Check and add'), new('06-menu-he.png', 'Menu', 'menu'),
        new('08-dish-sheet-he.png', 'One dish (a sheet)', 'one dish'), new('07-pictures-he.png', 'Pictures', 'pictures'),
        new(os.path.join('with-viewer-v2', '10-publish-he.png') if os.path.exists(os.path.join(OUT, 'with-viewer-v2', '10-publish-he.png')) else '10-publish-he.png', 'Publish', 'publish'),
        new('11-published-he.png', 'Published', 'published'),
        new('13-dashboard-empty-he.png', 'Home, first day', 'home after publishing'), new('12-dashboard-he.png', 'Home with guests'),
    ]
    missing = [s[0] for s in before + after if not (s[1] and os.path.exists(s[1]))]
    sheet('Before: the main path of the old owner app (branch master)', '390 × 844, Hebrew, the first screenful of each step. Sixteen screens from sign-in to a published menu.', before, os.path.join(OUT, 'before.jpg'), 8)
    sheet('After: the main path of version 2 (branch v2)', '390 × 844, Hebrew, the first screenful of each step. Start, place, then Menu → Pictures → Publish, then the dashboard. Step 9 shows the preview with the new guest viewer.', after, os.path.join(OUT, 'after.jpg'), 6)
    if missing:
        print('missing screenshots:', ', '.join(missing))
        sys.exit(1)


if __name__ == '__main__':
    main()
