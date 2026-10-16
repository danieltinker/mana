#!/usr/bin/env python3
"""Builds demo/kiosk/menu.json and demo/solo/menu.json.

Kiosk Livna is an invented small cafe whose owner has uploaded no photos: most items use a placeholder from the stock
library (asset = {"state": "stock", "id": ...}, CONTRACT v2.2), two have no picture at all. It is here so the placeholder
look can be seen and tested. "Solo" is a menu with ONE dish (it borrows a picture from demo/olea), for the one-dish case.
Names, prices and the cafe itself are invented. Run from view/:  python3 tools/build-kiosk.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
VIEW = os.path.dirname(HERE)
VG, VT, SP, GF = 'vegan', 'vegetarian', 'spicy', 'gf'


def L(en, he):
    return {'he': he, 'en': en}


def item(item_id, en, he, shekels, den='', dhe='', tags=(), stock=None, available=True, al_en='', al_he='', note=''):
    return {'id': item_id, 'name': L(en, he), 'desc': L(den, dhe), 'price': {'amount': shekels * 100, 'currency': 'ILS', 'note': note},
            'available': available, 'tags': list(tags), 'allergens': L(al_en, al_he), 'details': {},
            'asset': {'state': 'stock', 'id': stock} if stock else None}


def kiosk():
    cats = [
        {'id': 'morning', 'name': L('Morning', 'בוקר'), 'kind': 'food', 'scene': 'auto', 'items': [
            item('k-shakshuka', 'Shakshuka', 'שקשוקה', 48, 'Two eggs in tomato and pepper sauce, with bread', 'שתי ביצים ברוטב עגבניות ופלפלים, עם לחם', [VT, SP], 'shakshuka', al_en='Egg, gluten', al_he='ביצים, גלוטן'),
            item('k-salad', 'Garden salad', 'סלט גינה', 42, 'Whatever is fresh today, lemon and olive oil', 'מה שטרי היום, לימון ושמן זית', [VG, GF], 'salad'),
            item('k-hummus', 'Hummus with egg', 'חומוס עם ביצה', 36, 'Warm chickpeas, a boiled egg, pita', 'גרגירים חמים, ביצה קשה ופיתה', [VT], 'hummus', al_en='Sesame, egg, gluten', al_he='שומשום, ביצים, גלוטן'),
            item('k-toast', 'Cheese toast', 'טוסט גבינה', 32, 'Yellow cheese, tomato, olives on the side', 'גבינה צהובה, עגבנייה וזיתים בצד', [VT], None, al_en='Milk, gluten', al_he='חלב, גלוטן'),
        ]},
        {'id': 'lunch', 'name': L('Lunch', 'צהריים'), 'kind': 'food', 'scene': 'auto', 'items': [
            item('k-pasta', 'Tomato pasta', 'פסטה עגבניות', 52, 'Garlic, basil, parmesan', 'שום, בזיליקום ופרמזן', [VT], 'pasta', al_en='Gluten, milk', al_he='גלוטן, חלב'),
            item('k-burger', 'Kiosk burger', 'המבורגר הקיוסק', 58, 'Beef, pickles, a soft bun', 'בקר, חמוצים ולחמנייה רכה', [], 'burger', al_en='Gluten, sesame', al_he='גלוטן, שומשום'),
            item('k-pizza', 'Margherita pizza', 'פיצה מרגריטה', 54, 'Tomato, mozzarella, basil', 'עגבניות, מוצרלה ובזיליקום', [VT], 'pizza', available=False, al_en='Gluten, milk', al_he='גלוטן, חלב'),
        ]},
        {'id': 'sweet', 'name': L('Sweet', 'מתוק'), 'kind': 'dessert', 'scene': 'auto', 'items': [
            item('k-cheesecake', 'Cheesecake', 'עוגת גבינה', 34, 'Baked this morning', 'נאפתה הבוקר', [VT], 'cheesecake', al_en='Milk, egg, gluten', al_he='חלב, ביצים, גלוטן'),
            item('k-cookie', 'Date cookie', 'עוגיית תמרים', 12, '', '', [VG], None, al_en='Gluten, nuts', al_he='גלוטן, אגוזים'),
        ]},
        {'id': 'drinks', 'name': L('Drinks', 'שתייה'), 'kind': 'drinks', 'scene': 'auto', 'items': [
            item('k-orange', 'Orange juice', 'מיץ תפוזים', 18, 'Squeezed to order', 'נסחט במקום', [VG], 'orange-juice'),
            item('k-lemonade', 'Lemonade', 'לימונדה', 16, 'With mint', 'עם נענע', [VG], 'lemonade'),
            item('k-cappuccino', 'Cappuccino', 'הפוך', 14, '', '', [VT], 'cappuccino', al_en='Milk', al_he='חלב', note=L('small', 'קטן')),
        ]},
    ]
    return {'v': 1, 'slug': 'kiosk', 'revision': 1, 'publishedAt': '2026-10-07T09:00:00Z',
            'business': {'name': L('Kiosk Livna', 'קיוסק לבנה'), 'area': L('Garden corner', 'פינת הגן'), 'cuisine': L('Cafe', 'בית קפה'), 'kind': 'cafe', 'logo': None, 'orderUrl': None, 'phone': None},
            'locale': {'default': 'he', 'langs': ['he', 'en'], 'currency': 'ILS'},
            'theme': {'accent': '#6fd3c2', 'surface': 'walnut', 'tableImg': None}, 'categories': cats}


def solo():
    olea = json.load(open(os.path.join(VIEW, 'demo', 'olea', 'menu.json'), encoding='utf8'))
    hummus = next(it for c in olea['categories'] for it in c['items'] if it['id'] == 'hummus')
    it = json.loads(json.dumps(hummus))
    for k in ('color', 'aux', 'thumb'):
        it['asset'][k] = '../olea/' + it['asset'][k]
    it['id'] = 'solo-hummus'
    return {'v': 1, 'slug': 'solo', 'revision': 1, 'publishedAt': '2026-10-07T09:00:00Z',
            'business': {'name': L('One Dish', 'מנה אחת'), 'area': L('', ''), 'cuisine': L('Hummus', 'חומוסייה'), 'kind': 'restaurant', 'logo': None, 'orderUrl': None, 'phone': None},
            'locale': {'default': 'he', 'langs': ['he', 'en'], 'currency': 'ILS'},
            'theme': {'accent': '#e0a35c', 'surface': 'walnut', 'tableImg': None},
            'categories': [{'id': 'only', 'name': L('Hummus', 'חומוס'), 'kind': 'food', 'scene': 'auto', 'items': [it]}]}


for name, snap in (('kiosk', kiosk()), ('solo', solo())):
    d = os.path.join(VIEW, 'demo', name)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'menu.json'), 'w', encoding='utf8') as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    print(name, sum(len(c['items']) for c in snap['categories']), 'items')
