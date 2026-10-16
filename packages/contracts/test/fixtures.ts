/**
 * A SYNTHETIC menu for tests: "Café Demo", invented from scratch (names, dishes and prices are made up). No real venue's
 * data belongs in this repository. The ids match supabase/seed/synthetic.sql, so the database's published snapshot of
 * the seed and this fixture describe the same menu.
 */
import type { AddonGroupV2, DishV2, SnapshotV2, UpsellRuleV2 } from '../src/snapshot.ts';
import type { LiveOverlay } from '../src/live.ts';

const t = (he: string, en: string) => ({ he, en });
const none = t('', '');

export const ID = {
  venue: '00000000-0000-4000-8000-0000000000c1',
  // schedules
  breakfast: '00000000-0000-4000-8000-0000000005c1',
  friday: '00000000-0000-4000-8000-0000000005c2',
  // sections
  morning: '00000000-0000-4000-8000-00000000a001',
  mains: '00000000-0000-4000-8000-00000000a002',
  drinks: '00000000-0000-4000-8000-00000000a003',
  pastries: '00000000-0000-4000-8000-00000000a004',
  // dishes
  shakshuka: '00000000-0000-4000-8000-00000000d001',
  burger: '00000000-0000-4000-8000-00000000d002',
  schnitzel: '00000000-0000-4000-8000-00000000d003',
  espresso: '00000000-0000-4000-8000-00000000d004',
  lemonade: '00000000-0000-4000-8000-00000000d005',
  croissant: '00000000-0000-4000-8000-00000000d006',
  fridayCake: '00000000-0000-4000-8000-00000000d007',
  // add-on groups
  side: '00000000-0000-4000-8000-00000000b001',
  sauce: '00000000-0000-4000-8000-00000000b002',
  extras: '00000000-0000-4000-8000-00000000b003',
  size: '00000000-0000-4000-8000-00000000b004',
  milk: '00000000-0000-4000-8000-00000000b005',
  bread: '00000000-0000-4000-8000-00000000b006',
  // options
  fries: '00000000-0000-4000-8000-00000000e001',
  salad: '00000000-0000-4000-8000-00000000e002',
  sweetFries: '00000000-0000-4000-8000-00000000e003',
  aioli: '00000000-0000-4000-8000-00000000e004',
  ketchup: '00000000-0000-4000-8000-00000000e005',
  chipotle: '00000000-0000-4000-8000-00000000e006',
  cheese: '00000000-0000-4000-8000-00000000e007',
  egg: '00000000-0000-4000-8000-00000000e008',
  avocado: '00000000-0000-4000-8000-00000000e009',
  single: '00000000-0000-4000-8000-00000000e00a',
  double: '00000000-0000-4000-8000-00000000e00b',
  regularMilk: '00000000-0000-4000-8000-00000000e00c',
  oat: '00000000-0000-4000-8000-00000000e00d',
  soy: '00000000-0000-4000-8000-00000000e00e',
  sourdough: '00000000-0000-4000-8000-00000000e00f',
  challah: '00000000-0000-4000-8000-00000000e010',
  // rules
  ruleCroissant: '00000000-0000-4000-8000-00000000f001',
  ruleCheese: '00000000-0000-4000-8000-00000000f002',
  ruleLemonade: '00000000-0000-4000-8000-00000000f003',
} as const;

const opt = (id: string, he: string, en: string, price: number, extra: Partial<{ maxQty: number; default: boolean; opensGroupId: string | null }> = {}) => ({
  id, name: t(he, en), price, maxQty: extra.maxQty ?? 1, default: extra.default ?? false, opensGroupId: extra.opensGroupId ?? null,
});

export const GROUPS: AddonGroupV2[] = [
  { id: ID.side, name: t('תוספת', 'Side'), selection: 'single', min: 1, max: 1, options: [
    opt(ID.fries, 'צ׳יפס', 'Fries', 0, { default: true, opensGroupId: ID.sauce }),
    opt(ID.salad, 'סלט ירוק', 'Green salad', 0),
    opt(ID.sweetFries, 'בטטה', 'Sweet potato fries', 800, { opensGroupId: ID.sauce }),
  ] },
  { id: ID.sauce, name: t('רוטב', 'Sauce'), selection: 'single', min: 1, max: 1, options: [
    opt(ID.aioli, 'איולי', 'Aioli', 0, { default: true }),
    opt(ID.ketchup, 'קטשופ', 'Ketchup', 0),
    opt(ID.chipotle, 'צ׳יפוטלה', 'Chipotle', 200),
  ] },
  { id: ID.extras, name: t('תוספות', 'Extras'), selection: 'multiple', min: 0, max: 3, options: [
    opt(ID.cheese, 'גבינה', 'Cheese', 400, { maxQty: 2 }),
    opt(ID.egg, 'ביצת עין', 'Fried egg', 500),
    opt(ID.avocado, 'אבוקדו', 'Avocado', 600),
  ] },
  { id: ID.size, name: t('גודל', 'Size'), selection: 'single', min: 1, max: 1, options: [
    opt(ID.single, 'קצר', 'Single', 0, { default: true }),
    opt(ID.double, 'כפול', 'Double', 400),
  ] },
  { id: ID.milk, name: t('חלב', 'Milk'), selection: 'single', min: 0, max: 1, options: [
    opt(ID.regularMilk, 'רגיל', 'Regular', 0),
    opt(ID.oat, 'שיבולת שועל', 'Oat', 200),
    opt(ID.soy, 'סויה', 'Soy', 200),
  ] },
  { id: ID.bread, name: t('לחם', 'Bread'), selection: 'single', min: 1, max: 1, options: [
    opt(ID.sourdough, 'מחמצת', 'Sourdough', 0, { default: true }),
    opt(ID.challah, 'חלה', 'Challah', 0),
  ] },
];

const dish = (id: string, he: string, en: string, price: number | null, extra: Partial<DishV2> = {}): DishV2 => ({
  id, name: t(he, en), desc: none, price: price === null ? null : { amount: price, note: none }, tags: [], allergens: none, details: {},
  asset: null, scheduleId: null, addons: [], related: [], ...extra,
});

export const DISHES = {
  shakshuka: dish(ID.shakshuka, 'שקשוקה', 'Shakshuka', 5400, { tags: ['vegetarian'], addons: [{ groupId: ID.bread, min: 1, max: 1 }], related: [ID.espresso] }),
  burger: dish(ID.burger, 'המבורגר', 'Burger', 6800, {
    addons: [{ groupId: ID.side, min: 1, max: 1 }, { groupId: ID.extras, min: 0, max: 3 }], related: [ID.lemonade, ID.schnitzel],
  }),
  schnitzel: dish(ID.schnitzel, 'שניצל', 'Schnitzel', 6200, { addons: [{ groupId: ID.side, min: 1, max: 1 }] }),
  espresso: dish(ID.espresso, 'אספרסו', 'Espresso', 1200, { tags: ['vegan'], addons: [{ groupId: ID.size, min: 1, max: 1 }, { groupId: ID.milk, min: 0, max: 1 }], related: [ID.croissant] }),
  lemonade: dish(ID.lemonade, 'לימונדה', 'Lemonade', 1600, { tags: ['vegan'] }),
  croissant: dish(ID.croissant, 'קרואסון', 'Croissant', 1400, { tags: ['vegetarian'], asset: { state: 'stock', id: 'croissant' } }),
  fridayCake: dish(ID.fridayCake, 'עוגת שישי', 'Friday cake', 3200, { scheduleId: ID.friday }),
} satisfies Record<string, DishV2>;

export const RULES: UpsellRuleV2[] = [
  {
    id: ID.ruleCroissant, trigger: 'add', scope: { kind: 'dish', ids: [ID.espresso] }, when: { days: [], from: '07:00', to: '11:00' },
    basketHas: null, basketLacks: { dishes: [], sections: [ID.pastries] },
    suggest: { kind: 'dish', dishId: ID.croissant }, line: t('קרואסון חם ליד הקפה?', 'A warm croissant with your coffee?'), priority: 50, cap: 1, active: true,
  },
  {
    id: ID.ruleCheese, trigger: 'sheet', scope: { kind: 'dish', ids: [ID.burger] }, when: null,
    basketHas: null, basketLacks: null,
    suggest: { kind: 'option', groupId: ID.extras, optionId: ID.cheese }, line: t('להוסיף גבינה?', 'Add cheese?'), priority: 40, cap: 2, active: true,
  },
  {
    id: ID.ruleLemonade, trigger: 'checkout', scope: { kind: 'section', ids: [ID.mains] }, when: null,
    basketHas: null, basketLacks: { dishes: [], sections: [ID.drinks] },
    suggest: { kind: 'dish', dishId: ID.lemonade }, line: t('משהו לשתות?', 'Something to drink?'), priority: 30, cap: 1, active: true,
  },
];

/** Café Demo's hours: Sun–Thu 07:00–23:00, Fri 07:00–15:00, Sat 19:00–01:00 (past midnight). */
export const HOURS = {
  weekly: [
    { days: [0, 1, 2, 3, 4] as const, from: '07:00', to: '23:00' },
    { days: [5] as const, from: '07:00', to: '15:00' },
    { days: [6] as const, from: '19:00', to: '01:00' },
  ],
  closures: [] as { from: string; to: string }[],
};

export function cafeDemo(): SnapshotV2 {
  return structuredClone({
    v: 2,
    venueId: ID.venue,
    slug: 'cafe-demo',
    revision: 1,
    publishedAt: '2026-10-15T09:00:00Z',
    assetBase: 'https://example.invalid/storage/v1/object/public/menu-public/',
    venue: {
      name: t('קפה דמו', 'Café Demo'), area: t('', ''), cuisine: t('בית קפה', 'Café'), kind: 'cafe', mode: 'view_only', logo: null,
      orderUrl: null, bookUrl: null, phone: null, soldOut: 'bottom', timeZone: 'Asia/Jerusalem',
    },
    locale: { default: 'he', langs: ['he', 'en'], currency: 'ILS' },
    pricing: { includesVat: true, vatBasisPoints: 1800 },
    theme: { accent: '#c8743c', surface: 'oak', template: null, tableImg: null },
    schedules: [
      { id: ID.breakfast, kind: 'day_part', name: t('בוקר', 'Breakfast'), windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '12:00' }], validFrom: null, validTo: null },
      { id: ID.friday, kind: 'special', name: t('שישי', 'Friday'), windows: [{ days: [5], from: '07:00', to: '15:00' }], validFrom: null, validTo: null },
    ],
    sections: [
      { id: ID.morning, name: t('בוקר', 'Breakfast'), kind: 'food', scene: 'auto', room: null, scheduleId: ID.breakfast, dishes: [DISHES.shakshuka] },
      { id: ID.mains, name: t('עיקריות', 'Mains'), kind: 'food', scene: 'auto', room: null, scheduleId: null, dishes: [DISHES.burger, DISHES.schnitzel] },
      { id: ID.drinks, name: t('שתייה', 'Drinks'), kind: 'drinks', scene: 'auto', room: null, scheduleId: null, dishes: [DISHES.espresso, DISHES.lemonade] },
      { id: ID.pastries, name: t('מאפים', 'Pastries'), kind: 'dessert', scene: 'auto', room: null, scheduleId: null, dishes: [DISHES.croissant, DISHES.fridayCake] },
    ],
    addonGroups: GROUPS,
    upsellRules: RULES,
  } satisfies SnapshotV2) as SnapshotV2;
}

export function liveOf(off: LiveOverlay['off'] = [], at = '2026-10-15T09:00:00Z'): LiveOverlay {
  return { at, open: true, nextOpening: null, hours: structuredClone(HOURS) as unknown as LiveOverlay['hours'], off };
}

/** A mutable deep copy, for tests that break a snapshot on purpose. */
export const mutable = (s: SnapshotV2): any => structuredClone(s);
