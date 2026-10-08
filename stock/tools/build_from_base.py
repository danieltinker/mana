#!/usr/bin/env python3
"""Builds the placeholder ("stock") library entries that come from Halom's own generated reliefs in ../base/img.

Each entry: img/<id>.jpg (768 px colour), img/<id>.png (512 px, R = height, G = matte), img/<id>_t.jpg (256 px cut-out
on a dark tile), and one object in stock.json. The source pictures are Halom's own AI-generated dish previews
(see the project doc ops/hologram-menu-pipeline.md, section 4): they are illustrations, never a restaurant's real dish.
Which relief stands for which entry, and every entry's words, are in tools/catalog.json ("src": "base", "from": "<base id>").
Run from stock/:  python3 tools/build_from_base.py      (entries drawn in code are kept; see tools/drawn/)
"""
import json, os, re, shutil
from stocklib import STOCK, IMG, catalog, manifest_item, write_thumb, write_manifest

BASE = os.path.join(STOCK, '..', 'base')

with open(os.path.join(BASE, 'assets.js'), encoding='utf8') as f:
    ASSETS = json.loads(re.search(r'=\s*(\{.*\})\s*;', f.read(), re.S).group(1))


def build():
    os.makedirs(IMG, exist_ok=True)
    items = []
    for e in catalog()['entries']:
        if e['src'] != 'base':
            continue
        sid, src = e['id'], e['from']
        for ext in ('jpg', 'png'):
            shutil.copyfile(os.path.join(BASE, 'img', src + '.' + ext), os.path.join(IMG, sid + '.' + ext))
        write_thumb(sid)
        m = ASSETS[src]
        items.append(manifest_item(e, {'e': m['e'], 'h': m['h'], 'o': m.get('o'), 's': m.get('s')}))
    out = write_manifest(items, 'base')
    print(len(items), 'from base,', len(out['items']), 'entries in stock.json')


if __name__ == '__main__':
    build()
