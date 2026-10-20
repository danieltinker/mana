/**
 * QA-H2: random input through every reader, seeded so it is the same test on every run (the reviewers' vocabularies:
 * QA's menu-like lines and the security review's atoms). Every reader output must pass `validateDraft`, never throw,
 * read the same twice, and merge with itself to itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft, type ImportDraft } from '@mana/contracts';
import { mergeDrafts, parsePaste, parseWoltText, readScanReply, scanDraft } from '../src/index.ts';
import { seeded } from './helpers.ts';

const MENU = [
  '', 'Mains', 'עיקריות', '# Drinks', 'Desserts:', '=====', 'Soup', 'שניצל', 'Burger 72', '₪64.00', '64.00 ₪', '‏64.00 ₪', '+₪4.00', '+5', 'Free',
  'Required', 'Optional', 'Choose 1', 'Choose up to 2', 'בחרו עד 3', 'חובה', 'Fries › Choose a sauce', 'Sauce for fries', 'רוטב לצ׳יפס', 'Fries',
  'Salad', 'Add to order', 'Add to order ₪64.00', 'Allergens', 'Allergens: gluten', 'Vegan', 'Gluten free', 'Sold out', 'Popular', 'Most ordered',
  'Kosher', 'New', '9.2', '25–35 min', 'Open until 23:00', 'Delivery ₪9.90', '1', 'Crispy chicken, lemon and parsley…', 'with tahini', 'Wine 38 / 140',
  'from ₪48.00', '₪28.00 ₪32.00', '₪ 9O', 'Fish | 92 | daily', '🌶️', '🍕 Pizza 🍕 58', 'x'.repeat(120), 'a, b, c, d, e', 'Combo 1', '12-23', '\u0000bad',
  String.fromCharCode(0xd83c), 'קולה / Cola 12', 'Malabi\nHomemade', '₪₪', '(vegan)', 'Pasta (vegan) 54', 'Choose a side', 'Extras', 'Add a drink?',
  'Business lunch 12:00–16:00', 'Share', 'Delivery Box 2', 'House red 38 140', 'Tea for 2', '03-5551234', 'Funghi ₪46–62', 'Choose 2', 'Choose at least 3',
];
const ATOMS = ['₪', ' ', '.', '..', '…', '-', '–', '+', '/', '|', '·', ':', ',', '(', ')', '›', '"', '״', "'", '#', '=', '0', '1', '42', '9.90', '1,250', 'ש"ח',
  'NIS', 'Required', 'Optional', 'Choose up to 2', 'בחרו עד 2', 'חובה', 'Popular', 'פופולרי', 'Add to order', 'Allergens:', 'אלרגנים', 'vegan', 'טבעוני',
  'sold out', 'Schnitzel', 'שניצל', 'for', 'עבור', 'ל', 'Fries', 'Sauce', 'Mains', 'עיקריות', '‮', '​', '﻿', '\uD83C', '\uDF36', '🌶️', '\u0000', '\t',
  'x'.repeat(300), 'Delivery', 'min', '10:00–22:00', '★ 9.2', '(1,234)', '>', '»', 'é', 'ﬁ', 'ְ', 'Ⅻ'];
const SCAN = [
  '{"lang":"he"}', '{"c":{"he":"עיקריות","en":"Mains"},"k":"food"}', '{"n":{"he":"מרק","en":"Soup"},"p":"30"}', '{"n":{"he":"","en":"Stew"},"p":60}',
  '{"g":{"he":"","en":"Side"},"r":"Required · Choose 1","m":"single"}', '{"g":{"he":"","en":"Sauce"},"u":"Fries"}', '{"o":{"he":"","en":"Fries"}}',
  '{"o":{"he":"","en":"Rice"},"p":"+₪4","f":true}', '{"error":"unreadable"}', 'garbage', '{"n":', '{"o":{"he":"","en":"Side"},"p":"x"}',
  '{"g":{"he":"","en":"Side"},"r":"Choose up to 2","m":"multiple"}', '{"n":{"he":"מרק","en":"Soup"},"p":"38"}', '{"g":{"he":"","en":"🌶️"}}',
  '{"g":{"he":"","en":"Toppings"},"r":"Choose 3"}', '{"o":{"he":"","en":"Rice"},"p":"+₪5"}', '{"n":{"he":"","en":"Soup"},"p":"₪1e9"}',
];

function check(label: string, f: () => ImportDraft, failures: string[]): ImportDraft | null {
  try {
    const d = f();
    const v = validateDraft(d);
    if (!v.ok) failures.push(`${label}: invalid ${JSON.stringify(v.errors.slice(0, 3))}`);
    if (JSON.stringify(f()) !== JSON.stringify(d)) failures.push(`${label}: read twice, two drafts`);
    if (JSON.stringify(mergeDrafts([d, d]).draft) !== JSON.stringify(d)) failures.push(`${label}: merged with itself, changed`);
    return d;
  } catch (e) {
    failures.push(`${label}: threw ${(e as Error).message.slice(0, 120)}`);
    return null;
  }
}

test('QA-H2 fuzz: every reader\'s output on random input is a valid draft, read the same twice, unchanged merged with itself', () => {
  const rnd = seeded(12345);
  const failures: string[] = [];
  let runs = 0;
  const pastes: ImportDraft[] = [];
  for (let i = 0; i < 400; i++) {
    const menu = Array.from({ length: 1 + rnd(40) }, () => MENU[rnd(MENU.length)]!).join(rnd(3) === 0 ? '\r\n' : '\n');
    const atoms = Array.from({ length: 1 + rnd(40) }, () => Array.from({ length: 1 + rnd(6) }, () => ATOMS[rnd(ATOMS.length)]).join(rnd(2) ? ' ' : '')).join('\n');
    for (const text of [menu, atoms]) {
      runs += 2;
      const p = check(`paste ${JSON.stringify(text).slice(0, 160)}`, () => parsePaste(text).draft, failures);
      if (p && pastes.length < 40) pastes.push(p);
      check(`wolt ${JSON.stringify(text).slice(0, 160)}`, () => parseWoltText(text).draft, failures);
    }
    const answers = Array.from({ length: 1 + rnd(3) }, () => Array.from({ length: 1 + rnd(30) }, () => SCAN[rnd(SCAN.length)]!).join('\n'));
    runs += 1;
    const mode = rnd(2) ? 'scan_menu' : 'wolt_screenshots', langs: Array<'he' | 'en'> = rnd(2) ? ['he', 'en'] : ['he'];
    check(`scan ${JSON.stringify(answers).slice(0, 160)}`, () => scanDraft(mode,
      answers.map((a, k) => readScanReply(a, { langs, stock: [], page: k + 1, truncated: false }))).draft, failures);
  }
  for (let i = 0; i + 1 < pastes.length; i++) {
    runs += 1;
    check(`merge ${i}`, () => mergeDrafts([pastes[i]!, pastes[i + 1]!]).draft, failures);
  }
  assert.ok(runs > 2000);
  assert.deepEqual(failures.slice(0, 5), [], `${failures.length} of ${runs} runs failed`);
});
