#!/usr/bin/env python3
"""Builds demo/olea/ (menu.json + img/) from the reliefs in ../base/img.

Olea is an invented restaurant. Dish pictures are Halom's own generated reliefs; names, prices, producers
and breweries below are invented for the demo and belong to no real business.
Run from view/:  python3 tools/build-demo.py
"""
import json, os, re, shutil
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
VIEW = os.path.dirname(HERE)
BASE = os.path.join(VIEW, '..', 'base')
OUT = os.path.join(VIEW, 'demo', 'olea')
IMG = os.path.join(OUT, 'img')

with open(os.path.join(BASE, 'assets.js'), encoding='utf8') as f:
    ASSETS = json.loads(re.search(r'=\s*(\{.*\})\s*;', f.read(), re.S).group(1))

VG, VT, SP, GF = 'vegan', 'vegetarian', 'spicy', 'gf'
TILE = (31, 25, 20)          # the dark tile a cut-out thumbnail sits on


def kind_of(meta):
    if meta.get('o'):
        return 'stand'
    h = meta['h']
    return 'flat' if h < 0.09 else 'low' if h < 0.16 else 'medium' if h < 0.3 else 'tall'


def cutout(src):
    c = Image.open(os.path.join(BASE, 'img', src + '.jpg')).convert('RGB')
    a = Image.open(os.path.join(BASE, 'img', src + '.png')).convert('RGB').split()[1].resize(c.size, Image.LANCZOS)
    return c, a


def relief(item_id, src):
    for ext in ('jpg', 'png'):
        shutil.copyfile(os.path.join(BASE, 'img', src + '.' + ext), os.path.join(IMG, item_id + '.' + ext))
    c, a = cutout(src)
    t = Image.new('RGB', c.size, TILE)
    t.paste(c, (0, 0), a)
    t.resize((256, 256), Image.LANCZOS).save(os.path.join(IMG, item_id + '_t.jpg'), quality=82, optimize=True)
    m = ASSETS[src]
    return {'state': 'relief', 'color': 'img/%s.jpg' % item_id, 'aux': 'img/%s.png' % item_id, 'thumb': 'img/%s_t.jpg' % item_id,
            'kind': kind_of(m), 'e': m['e'], 'h': m['h'], 'o': m.get('o'), 's': m.get('s')}


def photo(item_id, src):
    """A plain photograph: the dish on a pale backdrop with a soft shadow. No height map, no matte."""
    c, a = cutout(src)
    w, h = c.size
    bg = Image.new('RGB', (w, h), (226, 219, 208))
    sh = Image.new('L', (w, h), 0)
    sh.paste(a.point(lambda v: int(v * 0.55)), (0, int(h * 0.035)))
    sh = sh.filter(ImageFilter.GaussianBlur(w * 0.03))
    bg.paste(Image.new('RGB', (w, h), (120, 104, 88)), (0, 0), sh)
    bg.paste(c, (0, 0), a)
    bg.save(os.path.join(IMG, item_id + '.jpg'), quality=86, optimize=True)
    bg.resize((256, 256), Image.LANCZOS).save(os.path.join(IMG, item_id + '_t.jpg'), quality=82, optimize=True)
    return {'state': 'photo', 'color': 'img/%s.jpg' % item_id, 'aux': None, 'thumb': 'img/%s_t.jpg' % item_id,
            'kind': None, 'e': None, 'h': None, 'o': None, 's': None}


def item(item_id, en, he, shekels, den='', dhe='', tags=(), src=None, available=True, al_en='', al_he='', details=None, note='', as_photo=False):
    asset = None
    if src:
        asset = photo(item_id, src) if as_photo else relief(item_id, src)
    return {'id': item_id, 'name': {'he': he, 'en': en}, 'desc': {'he': dhe, 'en': den},
            'price': {'amount': shekels * 100, 'currency': 'ILS', 'note': note}, 'available': available, 'tags': list(tags),
            'allergens': {'he': al_he, 'en': al_en}, 'details': details or {}, 'asset': asset}


def L(en, he):
    return {'he': he, 'en': en}


def wine(producer, name, vintage, region, grape, color, serving, **notes):
    return {'wine': {'producer': producer, 'name': name, 'vintage': vintage, 'region': region, 'grape': grape, 'serving': serving, 'color': color,
                     'notes': {k: notes.get(k, '') for k in ('sweetness', 'acidity', 'body', 'fruit', 'minerality', 'pairings')}}}


def beer(brewery, style, abv, serving, color):
    return {'beer': {'brewery': brewery, 'style': style, 'abv': abv, 'serving': serving, 'color': color}}


def main():
    if os.path.isdir(IMG):
        shutil.rmtree(IMG)
    os.makedirs(IMG)
    GLASS = L('150 ml glass', 'כוס 150 מ״ל')
    cats = [
        {'id': 'starters', 'name': L('To start', 'ראשונות'), 'kind': 'food', 'scene': 'auto', 'items': [
            item('labaneh', 'Labaneh & olives', 'לאבנה וזיתים', 38, 'Strained yogurt, za’atar, olive oil, cracked olives', 'לאבנה מסוננת, זעתר, שמן זית וזיתים דפוקים', [VT], 'abu-hassan-3', al_en='Milk', al_he='חלב'),
            item('hummus', 'Warm hummus', 'חומוס חם', 36, 'Whole chickpeas, tahini, paprika, parsley', 'גרגירים שלמים, טחינה, פפריקה ופטרוזיליה', [VG], 'hadayagim-0', al_en='Sesame', al_he='שומשום'),
            item('chopped-salad', 'Chopped salad', 'סלט קצוץ', 34, 'Tomato, cucumber, onion, parsley, lemon, olive oil', 'עגבנייה, מלפפון, בצל, פטרוזיליה, לימון ושמן זית', [VG, GF], 'hadayagim-2'),
            item('artichoke', 'Artichoke & pecorino', 'ארטישוק ופקורינו', 48, 'Kalamata olives, red onion, parsley, yogurt', 'זיתי קלמטה, בצל סגול, פטרוזיליה ויוגורט', [VT, GF], 'juno-1', al_en='Milk', al_he='חלב'),
            item('filo', 'Filo parcels', 'כיסוני פילו', 46, 'Baked with Camembert, garlic jam on the side', 'אפויים עם קממבר, ריבת שום בצד', [VT], 'juno-0', al_en='Milk, gluten', al_he='חלב, גלוטן'),
            item('caesar', 'Charred lettuce Caesar', 'קיסר חסה צרובה', 52, 'Lettuce hearts, croutons, parmesan, anchovy dressing', 'לבבות חסה, קרוטונים, פרמזן ורוטב אנשובי', [], 'pizza-lila-5', al_en='Fish, milk, egg, gluten', al_he='דגים, חלב, ביצים, גלוטן'),
            item('croquettes', 'Cheddar croquettes', 'קרוקט צ׳דר', 42, 'Three, with fig syrup', 'שלוש יחידות, עם סילאן תאנים', [VT], 'hamburger-26-1', al_en='Milk, gluten, egg', al_he='חלב, גלוטן, ביצים'),
            item('fish-soup', 'Fish soup', 'מרק דגים', 54, 'Tomato broth, white fish, coriander', 'ציר עגבניות, דג לבן וכוסברה', [GF], 'hadayagim-1', available=False, al_en='Fish', al_he='דגים'),
            item('bread', 'Bread & olive oil', 'לחם ושמן זית', 18, 'Sourdough from our oven, the house olive oil, coarse salt', 'לחם מחמצת מהטאבון, שמן הזית של הבית ומלח גס', [VG], None, al_en='Gluten', al_he='גלוטן'),
        ]},
        {'id': 'mains', 'name': L('Mains', 'עיקריות'), 'kind': 'food', 'scene': 'auto', 'items': [
            item('pappardelle', 'Salmon pappardelle', 'פפרדלה סלמון', 78, 'Fresh pasta, lemon zest, capers, cream, parmesan', 'פסטה טרייה, גרידת לימון, צלפים, שמנת ופרמזן', [], 'cafe-shneor-5', al_en='Fish, milk, gluten, egg', al_he='דגים, חלב, גלוטן, ביצים'),
            item('tortellini', 'Ricotta & spinach tortellini', 'טורטליני ריקוטה ותרד', 74, 'Butter, tomato seeds, basil, parmesan', 'חמאה, זרעי עגבניות, בזיליקום ופרמזן', [VT], 'juno-5', al_en='Milk, gluten, egg', al_he='חלב, גלוטן, ביצים'),
            item('gnocchi', 'Mushroom gnocchi', 'ניוקי פטריות', 76, 'Cream, mushrooms, chestnuts, a little truffle', 'שמנת, פטריות, ערמונים ומעט כמהין', [VT], 'juno-6', al_en='Milk, gluten', al_he='חלב, גלוטן'),
            item('meatballs', 'Chicken meatballs', 'קציצות עוף', 72, 'Tomato and pepper sauce, artichoke, herbs', 'רוטב עגבניות ופלפלים, ארטישוק ועשבי תיבול', [], 'cafe-shneor-6'),
            item('sea-bream', 'Whole sea bream', 'דניס שלם', 128, 'Grilled over charcoal, lemon, parsley', 'על הגריל, עם לימון ופטרוזיליה', [GF], 'hadayagim-3', al_en='Fish', al_he='דגים'),
            item('shrimp', 'Shrimp & calamari', 'שרימפס וקלמרי', 98, 'Garlic, butter, white wine', 'שום, חמאה ויין לבן', [GF], 'hadayagim-6', al_en='Shellfish, milk', al_he='פירות ים, חלב'),
            item('kebab', 'Lamb kebab', 'קבב טלה', 88, 'Three skewers, chopped salad, pickles', 'שלושה שיפודים, סלט קצוץ וחמוצים', [], 'busi-7'),
            item('burger', 'Olea burger', 'המבורגר אוליאה', 82, 'Beef, aged cheddar, mushrooms, rocket, fries', 'בקר, צ׳דר מיושן, פטריות, רוקט וצ׳יפס', [], 'hamburger-26-4', al_en='Milk, gluten, sesame', al_he='חלב, גלוטן, שומשום'),
        ]},
        {'id': 'oven', 'name': L('From the oven', 'מהטאבון'), 'kind': 'food', 'scene': 'auto', 'items': [
            item('margherita', 'Margherita', 'מרגריטה', 62, 'Tomato, fresh mozzarella, basil', 'עגבניות, מוצרלה טרייה ובזיליקום', [VT], 'pizza-lila-0', al_en='Milk, gluten', al_he='חלב, גלוטן'),
            item('zucchini', 'Zucchini & ricotta', 'קישואים וריקוטה', 68, 'Mozzarella, ricotta, lemon', 'מוצרלה, ריקוטה ולימון', [VT], 'pizza-lila-1', al_en='Milk, gluten', al_he='חלב, גלוטן'),
            item('onion-goat', 'Onion jam & goat cheese', 'ריבת בצל וגבינת עיזים', 72, 'Tomato, mozzarella, rocket', 'עגבניות, מוצרלה ורוקט', [VT], 'pizza-lila-2', al_en='Milk, gluten', al_he='חלב, גלוטן'),
            item('salami', 'Spicy salami', 'סלמי חריף', 76, 'Tomato, chilli, mozzarella, parmesan', 'עגבניות, צ׳ילי, מוצרלה ופרמזן', [SP], 'pizza-lila-3', al_en='Milk, gluten', al_he='חלב, גלוטן'),
            item('bianca', 'Bianca', 'ביאנקה', 70, 'Crème fraîche, spinach, mushrooms, parmesan', 'קרם פרש, תרד, פטריות ופרמזן', [VT], 'juno-3', al_en='Milk, gluten', al_he='חלב, גלוטן'),
            item('shakshuka', 'Baked shakshuka', 'שקשוקה בטאבון', 58, 'Three eggs in spicy tomato, served in the pan', 'שלוש ביצים ברוטב עגבניות חריף, מוגשת במחבת', [VT, SP], 'cafe-shneor-0', al_en='Egg', al_he='ביצים'),
            item('lasagne', 'Lasagne', 'לזניה', 74, 'Beef ragù, béchamel, parmesan', 'ראגו בקר, בשמל ופרמזן', [], 'pizza-lila-7', as_photo=True, al_en='Milk, gluten, egg', al_he='חלב, גלוטן, ביצים'),
        ]},
        {'id': 'sweet', 'name': L('Sweet', 'מתוקים'), 'kind': 'dessert', 'scene': 'auto', 'items': [
            item('cheesecake', 'Basque cheesecake', 'עוגת גבינה באסקית', 44, 'Burnt top, soft centre', 'קרום שרוף, לב רך', [VT], 'cafe-shneor-7', al_en='Milk, egg', al_he='חלב, ביצים'),
            item('knafeh', 'Knafeh & ice cream', 'כנאפה עם גלידה', 42, 'Served warm, with pistachio and goat’s-milk ice cream', 'מוגשת חמה, עם פיסטוק וגלידת חלב עיזים', [VT], 'yaffa-knafeh-1', al_en='Milk, gluten, nuts', al_he='חלב, גלוטן, אגוזים'),
            item('malabi', 'Malabi', 'מלבי', 32, 'Rose syrup, coconut, pistachio', 'סירופ ורדים, קוקוס ופיסטוק', [VT, GF], 'yaffa-knafeh-6', al_en='Milk, nuts', al_he='חלב, אגוזים'),
            item('lemon-tart', 'Lemon & pistachio tart', 'טארט לימון ופיסטוק', 38, '', '', [VT], 'busi-9', al_en='Milk, gluten, egg, nuts', al_he='חלב, גלוטן, ביצים, אגוזים'),
            item('brulee', 'Crème brûlée', 'קרם ברולה', 36, 'Vanilla, torched sugar', 'וניל וסוכר שרוף', [VT, GF], 'hamburger-26-8', available=False, al_en='Milk, egg', al_he='חלב, ביצים'),
            item('chocolate', 'Chocolate bar', 'אצבע שוקולד', 28, 'Ganache on a crisp base', 'גנאש על בסיס פריך', [VT], 'juno-8', al_en='Milk, gluten', al_he='חלב, גלוטן'),
        ]},
        # Wine and beer have no photos: the viewer draws a bottle and glass from these details. Every producer and brewery is invented.
        {'id': 'wine', 'name': L('Wine', 'יין'), 'kind': 'wine', 'scene': 'auto', 'items': [
            item('wine-white', 'House white', 'לבן הבית', 36, 'Crisp and citrusy', 'רענן והדרי', [], None, note=L('glass', 'כוס'),
                 details=wine('Nahal Shakedim', 'Lavan', '2024', L('Upper Galilee', 'הגליל העליון'), 'Sauvignon Blanc', 'white', L('By the glass, 150 ml', 'בכוס, 150 מ״ל'),
                              sweetness=L('Dry', 'יבש'), acidity=L('High', 'גבוהה'), body=L('Light', 'קל'), fruit=L('Citrus, green apple', 'הדרים, תפוח ירוק'),
                              minerality=L('Medium', 'בינונית'), pairings=L('Fish, labaneh, salads', 'דגים, לאבנה וסלטים'))),
            item('wine-rose', 'Rosé', 'רוזה', 38, 'Pale, dry, strawberry on the nose', 'בהיר ויבש, עם ניחוח תות', [], None, note=L('glass', 'כוס'),
                 details=wine('Shesh Ruchot', 'Vered', '2024', L('Judean Hills', 'הרי יהודה'), 'Grenache', 'rose', L('By the glass, 150 ml', 'בכוס, 150 מ״ל'))),
            item('wine-red', 'House red', 'אדום הבית', 38, 'Soft tannins, dark fruit', 'טאנינים רכים ופרי כהה', [], None, note=L('glass', 'כוס'),
                 details=wine('Nahal Shakedim', 'Adom', '2022', L('Upper Galilee', 'הגליל העליון'), 'Syrah, Carignan', 'red', L('By the glass, 150 ml', 'בכוס, 150 מ״ל'),
                              sweetness=L('Dry', 'יבש'), acidity=L('Medium', 'בינונית'), body=L('Medium', 'בינוני'), fruit=L('Plum, black pepper', 'שזיף, פלפל שחור'),
                              pairings=L('Kebab, burger, lasagne', 'קבב, המבורגר ולזניה'))),
            item('wine-orange', 'Orange wine', 'יין כתום', 44, 'Three weeks on the skins, a little grip', 'שלושה שבועות על הקליפות, מעט עפיצות', [], None, note=L('glass', 'כוס'),
                 details=wine('Tzlil HaEven', 'Orange No. 3', '2023', L('Negev Highlands', 'רמת הנגב'), 'French Colombard', 'orange', L('By the glass, 150 ml', 'בכוס, 150 מ״ל'),
                              fruit=L('Dried apricot, tea', 'משמש מיובש, תה'), pairings=L('Artichoke, pizza bianca', 'ארטישוק, פיצה ביאנקה'))),
            item('wine-sparkling', 'Sparkling brut', 'מבעבע ברוט', 168, 'For the table', 'לכל השולחן', [], None, note=L('bottle', 'בקבוק'),
                 details=wine('Casa Lumera', 'Brut Nature', 'NV', L('Veneto, Italy', 'ונטו, איטליה'), 'Glera', 'sparkling', L('750 ml bottle', 'בקבוק 750 מ״ל'))),
        ]},
        {'id': 'beer', 'name': L('Beer', 'בירה'), 'kind': 'beer', 'scene': 'auto', 'items': [
            item('beer-lager', 'Lager', 'לאגר', 28, 'Clean and malty', 'נקייה ולתתית', [], None, note=L('half litre', 'חצי ליטר'), details=beer('Simta Brewing', 'Helles lager', '4.8%', 'tap', 'pale')),
            item('beer-ipa', 'IPA', 'IPA', 32, 'Bitter, grapefruit and pine', 'מרירה, עם אשכולית ואורן', [], None, note=L('half litre', 'חצי ליטר'), details=beer('Simta Brewing', 'West Coast IPA', '6.2%', 'tap', 'amber')),
            item('beer-wheat', 'Wheat beer', 'בירת חיטה', 29, 'Cloudy, banana and clove', 'עכורה, עם בננה וציפורן', [], None, note=L('330 ml', '330 מ״ל'), details=beer('Gan HaShaked', 'Hefeweizen', '5.1%', 'bottle', 'pale')),
            item('beer-stout', 'Stout', 'סטאוט', 30, 'Roasted, dry, coffee finish', 'קלויה ויבשה, עם סיומת קפה', [], None, note=L('330 ml', '330 מ״ל'), details=beer('Tzuk Brewing', 'Dry stout', '4.5%', 'can', 'dark')),
        ]},
        {'id': 'cold', 'name': L('Cold drinks', 'משקאות קרים'), 'kind': 'drinks', 'scene': 'auto', 'items': [
            item('orange-juice', 'Fresh orange juice', 'מיץ תפוזים סחוט', 18, 'Squeezed to order', 'נסחט במקום', [VG], 'cafe-shneor-9'),
            item('lemonade', 'Lemonade with mint', 'לימונדה עם נענע', 34, 'A pitcher for the table', 'קנקן לשולחן', [VG], 'hadayagim-8', note=L('pitcher', 'קנקן')),
            item('iced-tea', 'Peach iced tea', 'תה קר עם אפרסק', 18, 'Cold-brewed, lightly sweet', 'בחליטה קרה, מתוק בעדינות', [VG], 'koko-neko-8'),
            item('mojito', 'Lemongrass mojito', 'מוחיטו למון גראס', 26, 'No alcohol. Lemongrass, mint, lime, soda', 'ללא אלכוהול. למון גראס, נענע, ליים וסודה', [VG], 'thai-sinai-8'),
        ]},
    ]
    snap = {
        'v': 1, 'slug': 'olea', 'revision': 1, 'publishedAt': '2026-10-05T12:00:00Z',
        'business': {'name': L('Olea', 'אוליאה'), 'area': L('4 Olive Lane', 'סמטת הזית 4'), 'cuisine': L('Neighbourhood bistro', 'ביסטרו שכונתי'),
                     'logo': None, 'orderUrl': 'https://example.com/olea', 'phone': None},
        'locale': {'default': 'he', 'langs': ['he', 'en'], 'currency': 'ILS'},
        'theme': {'accent': '#c9c56a', 'surface': 'oak', 'tableImg': None},
        'categories': cats,
    }
    with open(os.path.join(OUT, 'menu.json'), 'w', encoding='utf8') as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    n = sum(len(c['items']) for c in cats)
    size = sum(os.path.getsize(os.path.join(IMG, x)) for x in os.listdir(IMG))
    print('categories', len(cats), 'items', n, 'images', len(os.listdir(IMG)), 'bytes', size)


if __name__ == '__main__':
    main()
