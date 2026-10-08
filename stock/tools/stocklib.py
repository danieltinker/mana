"""Shared by the build tools: the catalogue, the manifest writer, the thumbnail and the hologram-tint mock."""
import json, os, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
STOCK = os.path.dirname(HERE)
IMG = os.path.join(STOCK, 'img')
TILE = (31, 25, 20)                      # the dark tile thumbnails sit on (same as the starter)
ID_RE = re.compile(r'^[a-z0-9][a-z0-9-]{0,39}$')


def catalog():
    with open(os.path.join(HERE, 'catalog.json'), encoding='utf8') as f:
        c = json.load(f)
    ids = [e['id'] for e in c['entries']]
    assert len(set(ids)) == len(ids), 'duplicate id in catalog.json'
    for e in c['entries']:
        assert ID_RE.match(e['id']), e['id']
        assert e['group'] in c['groups'], (e['id'], e['group'])
        assert e['src'] in ('base', 'drawn'), e['id']
    return c


def kind_of(meta):
    if meta.get('o'):
        return 'stand'
    h = meta['h']
    return 'flat' if h < 0.09 else 'low' if h < 0.16 else 'medium' if h < 0.3 else 'tall'


def manifest_item(entry, meta):
    """One stock.json object in the contract's shape (CONTRACT v2.3)."""
    sid = entry['id']
    it = {'id': sid, 'group': entry['group'], 'name': {'he': entry['he'], 'en': entry['en']}, 'keys': entry['keys']}
    if entry.get('not'):
        it['not'] = entry['not']
    if entry.get('cat'):
        it['cat'] = True
    it.update({'color': 'img/%s.jpg' % sid, 'aux': 'img/%s.png' % sid, 'thumb': 'img/%s_t.jpg' % sid,
               'kind': kind_of(meta), 'e': meta['e'], 'h': meta['h'], 'o': meta.get('o'), 's': meta.get('s'), 'src': entry['src']})
    if entry.get('hidden'):
        it['hidden'] = True
    return it


def write_thumb(sid):
    """256 px cut-out on the dark tile, from img/<id>.jpg and the matte in img/<id>.png."""
    c = Image.open(os.path.join(IMG, sid + '.jpg')).convert('RGB')
    a = Image.open(os.path.join(IMG, sid + '.png')).convert('RGB').split()[1].resize(c.size, Image.LANCZOS)
    t = Image.new('RGB', c.size, TILE)
    t.paste(c, (0, 0), a)
    t.resize((256, 256), Image.LANCZOS).save(os.path.join(IMG, sid + '_t.jpg'), quality=82, optimize=True)


def write_manifest(new_items, src):
    """Replace every entry of this source in stock.json with new_items, keep the other source's entries, and put
    everything in catalogue order. Entries that are no longer in the catalogue are dropped only for this source."""
    c = catalog()
    order = {e['id']: i for i, e in enumerate(c['entries'])}
    path = os.path.join(STOCK, 'stock.json')
    keep = []
    if os.path.exists(path):
        with open(path, encoding='utf8') as f:
            keep = [e for e in json.load(f)['items'] if e.get('src') != src and e['id'] in order]
    by_id = {e['id']: e for e in keep}
    for it in new_items:
        by_id[it['id']] = it
    cat = {e['id']: e for e in c['entries']}
    for sid, it in list(by_id.items()):     # words always come from the catalogue, whichever tool ran last
        by_id[sid] = manifest_item(cat[sid], it)
    items = sorted(by_id.values(), key=lambda e: (c['groups'].index(e['group']), order[e['id']]))
    out = {'v': 1, 'label': c['label'], 'items': items}
    with open(path, 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    for name in os.listdir(IMG):                         # pictures of entries that left the catalogue go with them
        sid = re.sub(r'(_t)?\.(jpg|png)$', '', name)
        if sid not in order:
            os.remove(os.path.join(IMG, name))
    return out


def holo_mock(rgb, alpha, accent=(0.37, 0.82, 1.0), bg=(8, 12, 18), size=None):
    """What a placeholder roughly looks like as a hologram: the viewer's DISH_FS, unfocused (tint, scan lines, lit rim).
    rgb uint8 HxWx3, alpha uint8 HxW. A flat mock for the contact sheets, not the viewer."""
    c = np.asarray(rgb, np.float32) / 255
    a = np.asarray(alpha, np.float32) / 255
    acc = np.array(accent, np.float32)
    lum = c @ np.array([.299, .587, .114], np.float32)
    holo = acc[None, None] * (lum[..., None] * 1.3 + .05) * .82 + c * .18
    yy = np.arange(c.shape[0], dtype=np.float32)[:, None]
    sl = .5 + .5 * np.sin(yy * 1.7 * (768 / c.shape[0]))
    col = holo * (1 - .30 * sl)[..., None]
    edge = np.clip((a - .03) / .47, 0, 1) * (1 - np.clip((a - .6) / .39, 0, 1))
    col = col + acc[None, None] * edge[..., None] * .9
    al = (a * .86)[..., None]
    out = col * al + (np.array(bg, np.float32) / 255)[None, None] * (1 - al)
    im = Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8))
    return im.resize((size, size), Image.LANCZOS) if size else im
