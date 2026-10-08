#!/usr/bin/env python3
"""Writes NOTICE.md: where every picture in the library comes from. Run from stock/:  python3 tools/notice.py"""
import json, os, re, subprocess
from stocklib import STOCK, catalog

BASE = os.path.join(STOCK, '..', 'base')


def base_names():
    js = "const fs=require('fs');const window={};eval(fs.readFileSync(process.argv[1],'utf8'));const o={};for(const m of window.HALOM_MENUS)m.dishes.forEach((d,i)=>{o[m.id+'-'+i]=d.n.en});console.log(JSON.stringify(o))"
    return json.loads(subprocess.check_output(['node', '-e', js, os.path.join(BASE, 'data.js')]).decode('utf8'))


def main():
    c = catalog(); names = base_names()
    base = [e for e in c['entries'] if e['src'] == 'base']; drawn = [e for e in c['entries'] if e['src'] == 'drawn']
    L = []
    L += ['# Where the placeholder pictures come from', '',
          'Mana shows these pictures for a dish that has no photo of its own. They are illustrations and are always labelled',
          '"להמחשה בלבד · Illustration". None of them is a restaurant\'s real dish.', '',
          'No third-party asset is in this folder: no stock photo, no downloaded model or texture, no font inside a picture.',
          'No picture shows a brand name, a logo or readable text.', '',
          '## %d pictures from Halom\'s own reliefs (`"src": "base"`)' % len(base), '',
          'Copied unchanged from `../base/img/`: the dish previews Halom generated for its ten demo menus (Higgsfield',
          '`gpt_image_2_5`, see the project doc `ops/hologram-menu-pipeline.md`, section 4) and turned into reliefs with Halom\'s',
          'own pipeline (two Apache-2.0 models). The dish lists were read on 2026-10-03 and the relief files are dated 2026-10-05,',
          'so the pictures were generated between those days; the exact day of each is not recorded here.',
          'The demo dishes carried restaurant and brand names in their titles (a beer, a wine); the pictures themselves were',
          'checked at full size on 2026-10-07 and show plain glasses and unlabelled bottles.', '',
          '| id | relief in `base/img` | generated as |', '|---|---|---|']
    L += ['| `%s` | `%s` | %s |' % (e['id'], e['from'], names.get(e['from'], '')) for e in base]
    L += ['', '## %d pictures drawn in code (`"src": "drawn"`)' % len(drawn), '',
          'Each is a small 3D model written by hand as a distance function in `tools/drawn/objects/<id>.glsl`, lit and rendered by',
          '`tools/drawn/lib.glsl` in headless Chromium (software WebGL) on 2026-10-07, on this machine, with no network. No image,',
          '3D or other generation service was used and nothing was paid for. The height picture is exact: it is measured from the',
          'model, not estimated.', '', ', '.join('`%s`' % e['id'] for e in drawn) + '.', '',
          '## Words', '',
          'The match words in `stock.json` include names of well-known beers and soft drinks (so that an item called',
          '"גולדסטאר" finds the beer picture). They are words to search by. They are never shown to a guest.', '',
          '## Built with', '',
          'Python 3 with Pillow, numpy and OpenCV; Node with Playwright and Chromium. All are build tools; none is shipped.',
          'Rebuild everything: `python3 tools/build_from_base.py && node tools/drawn/render.mjs && python3 tools/drawn/build_drawn.py',
          '&& python3 tools/sheets.py && python3 tools/notice.py`, then `node --test tools/match.test.mjs`.', '']
    with open(os.path.join(STOCK, 'NOTICE.md'), 'w', encoding='utf8') as f:
        f.write('\n'.join(L))
    print('NOTICE.md:', len(base), 'base,', len(drawn), 'drawn')


if __name__ == '__main__':
    main()
