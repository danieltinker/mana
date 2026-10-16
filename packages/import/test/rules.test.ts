import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessKind, readRule, ruleLimits } from '../src/index.ts';
import { joinRules, nameMarkers, NO_RULE, readAllergens, readLabel, readTags } from '../src/rules.ts';

const limits = (line: string) => { const r = readRule(line); return r && { ...ruleLimits(r.rule), heading: r.heading }; };

test('group_rule: what a group states, in English and Hebrew', () => {
  assert.deepEqual(limits('Required'), { selection: 'single', min: 1, max: null, heading: null });
  assert.deepEqual(limits('חובה'), { selection: 'single', min: 1, max: null, heading: null });
  assert.deepEqual(limits('Optional'), { selection: 'multiple', min: null, max: null, heading: null }, 'optional alone states no limits');
  assert.deepEqual(limits('רשות'), { selection: 'multiple', min: null, max: null, heading: null });
  assert.deepEqual(limits('Choose 1'), { selection: 'single', min: 1, max: 1, heading: null });
  assert.deepEqual(limits('בחרו 1'), { selection: 'single', min: 1, max: 1, heading: null });
  assert.deepEqual(limits('בחירה אחת'), { selection: 'single', min: 1, max: 1, heading: null });
  assert.deepEqual(limits('Choose two'), { selection: 'multiple', min: 2, max: 2, heading: null });
  assert.deepEqual(limits('Choose up to 2'), { selection: 'multiple', min: null, max: 2, heading: null });
  assert.deepEqual(limits('בחרו עד 3'), { selection: 'multiple', min: null, max: 3, heading: null });
  assert.deepEqual(limits('עד 2'), { selection: 'multiple', min: null, max: 2, heading: null });
  assert.deepEqual(limits('Choose up to 1'), { selection: 'single', min: 0, max: 1, heading: null });
  assert.deepEqual(limits('Choose at least 1'), { selection: 'multiple', min: 1, max: null, heading: null });
  assert.deepEqual(limits('לפחות 2'), { selection: 'multiple', min: 2, max: null, heading: null });
  assert.deepEqual(limits('Choose 1-3'), { selection: 'multiple', min: 1, max: 3, heading: null });
  assert.deepEqual(limits('בין 1 ל-3'), { selection: 'multiple', min: 1, max: 3, heading: null });
  assert.deepEqual(limits('Required · Choose up to 2'), { selection: 'multiple', min: 1, max: 2, heading: null });
  assert.deepEqual(limits('Optional • Choose 1'), { selection: 'single', min: 0, max: 1, heading: null });
  assert.deepEqual(limits('חובה · בחרו 1'), { selection: 'single', min: 1, max: 1, heading: null });
  assert.deepEqual(limits('Choose 2 items'), { selection: 'multiple', min: 2, max: 2, heading: null }, 'counted words name nothing');
});

test('group_rule: a line that also names its group', () => {
  assert.deepEqual(limits('Choose up to 2 sauces'), { selection: 'multiple', min: null, max: 2, heading: 'Choose up to 2 sauces' });
  assert.deepEqual(limits('בחרו עד 2 תוספות'), { selection: 'multiple', min: null, max: 2, heading: 'בחרו עד 2 תוספות' });
  assert.deepEqual(limits('Choose a side (required)'), { selection: 'single', min: 1, max: null, heading: 'Choose a side' });
});

test('group_rule: lines that are not rules', () => {
  for (const s of ['Choose a side', 'בחרו תוספת', 'Add 2 eggs', 'Extras', 'Salad (optional dressing)', 'Fries', '']) assert.equal(readRule(s), null, s);
});

test('joinRules: two rule lines make one rule; the first statement stays', () => {
  const required = readRule('Required')!.rule, one = readRule('Choose 1')!.rule;
  assert.deepEqual(ruleLimits(joinRules(required, one)), { selection: 'single', min: 1, max: 1 });
  assert.deepEqual(ruleLimits(NO_RULE), { selection: 'multiple', min: null, max: null }, 'no rule: nothing stated');
});

test('tags: only a line made of Mana tag labels', () => {
  assert.deepEqual(readTags('Vegan'), ['vegan']);
  assert.deepEqual(readTags('טבעוני · ללא גלוטן'), ['vegan', 'gf']);
  assert.deepEqual(readTags('Gluten-free'), ['gf']);
  assert.deepEqual(readTags('🌶️'), ['spicy']);
  assert.deepEqual(readTags('Spicy / Vegan'), ['spicy', 'vegan']);
  for (const s of ['Vegan burger', 'Kosher', 'V', 'Halal', 'Two eggs in a spicy tomato sauce']) assert.equal(readTags(s), null, s);
});

test('name_markers: tag labels at the end of a name; any other marker stays in it', () => {
  assert.deepEqual(nameMarkers('Falafel (vegan)'), { name: 'Falafel', tags: ['vegan'] });
  assert.deepEqual(nameMarkers('סלט (ללא גלוטן) (טבעוני)'), { name: 'סלט', tags: ['gf', 'vegan'] });
  assert.deepEqual(nameMarkers('Curry 🌶️'), { name: 'Curry', tags: ['spicy'] });
  assert.deepEqual(nameMarkers('Salad (V)'), { name: 'Salad (V)', tags: [] }, '(V) may be vegan or vegetarian');
  assert.deepEqual(nameMarkers('(vegan)'), { name: '(vegan)', tags: [] }, 'a name is never only a marker');
});

test('labels: sold out, popular, new, discount, other; allergens copied as written', () => {
  assert.equal(readLabel('Sold out'), 'sold_out');
  assert.equal(readLabel('אזל מהמלאי'), 'sold_out');
  assert.equal(readLabel('Unavailable'), 'sold_out');
  assert.equal(readLabel('Popular'), 'popular');
  assert.equal(readLabel('פופולרי'), 'popular');
  assert.equal(readLabel('New'), 'new');
  assert.equal(readLabel('-20%'), 'discount');
  assert.equal(readLabel('כשר'), 'other');
  assert.equal(readLabel('Schnitzel'), null);
  assert.deepEqual(readAllergens('Allergens: gluten, egg'), { text: 'gluten, egg' });
  assert.deepEqual(readAllergens('אלרגנים: גלוטן, ביצים'), { text: 'גלוטן, ביצים' });
  assert.deepEqual(readAllergens('Allergens'), { text: null }, 'a heading: the list is on the next line');
  assert.equal(readAllergens('Allergen-free salad'), null);
});

test('guessKind: a section kind from its heading, food otherwise', () => {
  assert.equal(guessKind('Wines'), 'wine');
  assert.equal(guessKind('יינות'), 'wine');
  assert.equal(guessKind('Beers on tap'), 'beer');
  assert.equal(guessKind('קינוחים'), 'dessert');
  assert.equal(guessKind('Hot drinks'), 'drinks');
  assert.equal(guessKind('שתייה'), 'drinks');
  assert.equal(guessKind('Mains'), 'food');
});
