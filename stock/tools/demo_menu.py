#!/usr/bin/env python3
"""A demo menu made of the library itself, for looking at the placeholders in the real viewer.
python3 tools/demo_menu.py <viewer folder>   writes <viewer>/demo/stock/menu.json and links <viewer>/demo/stock/img -> stock/img
Open <viewer>/?demo=stock (add &surface=holo for the projector look). The viewer is not part of this folder: copy the
published one (halom-projects/projects/menus/view) somewhere scratch first."""
import json, os, sys
from stocklib import STOCK, IMG

KIND = {'hot-drinks': 'drinks', 'cold-drinks': 'drinks', 'cocktails': 'drinks', 'wine': 'drinks', 'beer': 'drinks', 'desserts': 'dessert', 'bakery': 'dessert'}
NAMES = {'hot-drinks': ('משקאות חמים', 'Hot drinks'), 'cold-drinks': ('משקאות קרים', 'Cold drinks'), 'cocktails': ('קוקטיילים', 'Cocktails'), 'wine': ('יין', 'Wine'), 'beer': ('בירה', 'Beer'),
         'breakfast': ('בוקר', 'Breakfast'), 'bakery': ('מאפים', 'Bakery'), 'starters': ('ראשונות', 'Starters'), 'salads': ('סלטים', 'Salads'), 'soups': ('מרקים', 'Soups'), 'pizza': ('פיצה', 'Pizza'),
         'pasta': ('פסטה', 'Pasta'), 'burgers': ('המבורגרים', 'Burgers'), 'sandwiches': ('כריכים', 'Sandwiches'), 'meat': ('בשר', 'Meat'), 'chicken': ('עוף', 'Chicken'), 'fish': ('דגים', 'Fish'),
         'asian': ('אסייתי', 'Asian'), 'sides': ('תוספות', 'Sides'), 'desserts': ('קינוחים', 'Desserts')}


def build(viewer, only=None):
    man = json.load(open(os.path.join(STOCK, 'stock.json'), encoding='utf8'))
    out = os.path.join(viewer, 'demo', 'stock')
    os.makedirs(out, exist_ok=True)
    link = os.path.join(out, 'img')
    if not os.path.exists(link):
        os.symlink(IMG, link)
    cats = {}
    for e in man['items']:
        if only and e['id'] not in only:
            continue
        g = e['group']
        cats.setdefault(g, {'id': g, 'name': {'he': NAMES[g][0], 'en': NAMES[g][1]}, 'kind': KIND.get(g, 'food'), 'scene': 'auto', 'items': []})
        cats[g]['items'].append({'id': e['id'], 'name': e['name'], 'desc': {'he': man['label']['he'], 'en': man['label']['en'] + ' · ' + e['src']}, 'price': None, 'available': True, 'tags': [],
                                 'allergens': {'he': '', 'en': ''}, 'details': {},
                                 'asset': {'state': 'relief', 'color': e['color'], 'aux': e['aux'], 'thumb': e['thumb'], 'kind': e['kind'], 'e': e['e'], 'h': e['h'], 'o': e['o'], 's': e['s']}})
    menu = {'v': 1, 'slug': 'stock', 'revision': 1, 'publishedAt': '2026-10-07T12:00:00Z',
            'business': {'name': {'he': 'ספריית ההמחשות', 'en': 'Placeholder library'}, 'area': {'he': '', 'en': ''}, 'cuisine': {'he': 'בדיקה', 'en': 'Check'}, 'logo': None, 'orderUrl': None, 'phone': None},
            'locale': {'default': 'en', 'langs': ['he', 'en'], 'currency': 'ILS'}, 'theme': {'accent': '#5fd0ff', 'surface': 'oak', 'tableImg': None}, 'categories': list(cats.values())}
    with open(os.path.join(out, 'menu.json'), 'w', encoding='utf8') as f:
        json.dump(menu, f, ensure_ascii=False)
    print(len(cats), 'categories,', sum(len(c['items']) for c in cats.values()), 'items ->', out)


if __name__ == '__main__':
    build(sys.argv[1], set(sys.argv[2:]) or None)
