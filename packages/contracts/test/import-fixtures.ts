/**
 * A SYNTHETIC import draft for tests, invented from scratch: "Bistro Draft", with a schnitzel whose side of choice
 * opens a nested sauce, a burger with paid extras, and a lemonade. No real venue's menu belongs in this repository.
 * Also a reference executor that applies an `ImportPlan` to an `ExistingMenu` in memory, the way `apply_import` writes
 * the tables, so a test can re-import into the result.
 */
import type {
  DraftDish, DraftGroup, DraftOption, DraftSection, ExistingMenu, ImportDraft, ImportPlan, PlanStep,
} from '../src/import.ts';

export const tx = (he: string, en: string) => ({ he, en });
export const NONE = tx('', '');

export const dish = (key: string, he: string, en: string, price: number | null, o: Partial<DraftDish> = {}): DraftDish => ({
  key, name: tx(he, en), desc: NONE, translated: [], price, priceText: null, priceNote: NONE, tags: [], allergens: NONE, photo: null,
  illustration: null, groups: [], ...o,
});
export const opt = (key: string, he: string, en: string, price: number | null, o: Partial<DraftOption> = {}): DraftOption => ({
  key, name: tx(he, en), translated: [], price, priceText: null, maxQty: 1, default: false, opens: null, ...o,
});
export const group = (key: string, he: string, en: string, o: Partial<DraftGroup> & Pick<DraftGroup, 'options'>): DraftGroup => ({
  key, name: tx(he, en), translated: [], selection: 'single', min: 1, max: 1, ...o,
});
export const section = (key: string, he: string, en: string, dishes: DraftDish[], o: Partial<DraftSection> = {}): DraftSection => ({
  key, name: tx(he, en), translated: [], kind: 'food', room: null, dishes, ...o,
});
export const link = (g: string, min: number | null = null, max: number | null = null) => ({ group: g, min, max });

/** The base draft: two sections, three dishes, three groups (one nested), as a Wolt-text reader would produce it. */
export function bistroDraft(): ImportDraft {
  return {
    v: 1,
    source: 'wolt_text',
    sections: [
      section('s-mains', 'עיקריות', 'Mains', [
        dish('d-schnitzel', 'שניצל', 'Schnitzel', 6400, { groups: [link('g-side')] }),
        dish('d-burger', 'המבורגר', 'Burger', 7200, { tags: ['spicy'], groups: [link('g-side'), link('g-extras')] }),
      ]),
      section('s-drinks', 'שתייה', 'Drinks', [dish('d-lemonade', 'לימונדה', 'Lemonade', 1800)], { kind: 'drinks' }),
    ],
    groups: [
      group('g-side', 'תוספת', 'Side of choice', { options: [opt('o-fries', 'צ׳יפס', 'Fries', 0, { opens: 'g-sauce' }), opt('o-salad', 'סלט', 'Salad', 0)] }),
      group('g-sauce', 'רוטב', 'Sauce', { options: [opt('o-aioli', 'איולי', 'Aioli', 0), opt('o-ketchup', 'קטשופ', 'Ketchup', 0)] }),
      group('g-extras', 'תוספות', 'Extras', {
        selection: 'multiple', min: null, max: null, options: [opt('o-cheese', 'גבינה', 'Cheese', 300, { maxQty: 2 }), opt('o-egg', 'ביצה', 'Egg', 400)],
      }),
    ],
  };
}

/** A deep copy that a test may change. */
export const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const REF_KIND: Record<string, PlanStep['kind']> = { section_id: 'section', group_id: 'group', opens_group_id: 'group', dish_id: 'dish' };

/**
 * Checks what every plan must be: no op but create, update, keep or skip; `set` only on create and update (never
 * empty on update); an id exactly on update and keep (photos: keep names the existing asset); every ref names a node
 * the same plan creates, of the right kind, earlier in apply order.
 */
export function planProblems(plan: ImportPlan): string[] {
  const out: string[] = [];
  const created = new Map<string, PlanStep['kind']>();
  for (const s of plan.steps) {
    if (!['create', 'update', 'keep', 'skip'].includes(s.op)) out.push(`${s.key}: op ${s.op}`);
    if ((s.op === 'keep' || s.op === 'skip') && Object.keys(s.set).length > 0) out.push(`${s.key}: set on ${s.op}`);
    if (s.op === 'update' && Object.keys(s.set).length === 0) out.push(`${s.key}: empty update`);
    if (s.op === 'update' && s.id === null) out.push(`${s.key}: update without id`);
    if ((s.op === 'create' || s.op === 'skip') && s.id !== null) out.push(`${s.key}: id on ${s.op}`);
    if (s.op === 'skip' && s.reason === null) out.push(`${s.key}: skip without reason`);
    for (const [col, ref] of Object.entries(s.refs)) {
      if (created.get(ref) !== REF_KIND[col]) out.push(`${s.key}: ${col} → ${ref} is not a ${REF_KIND[col]} created earlier`);
      if (col in s.set) out.push(`${s.key}: ${col} both set and ref`);
    }
    if (s.op === 'create') created.set(s.key, s.kind);
  }
  return out;
}

/** Applies a plan in memory, as `apply_import` writes the tables (ids are made up, deterministic). */
export function applyPlan(menu: ExistingMenu, plan: ImportPlan, idBase = 0xa00000000000): ExistingMenu {
  const out = copy(menu) as unknown as {
    sections: Array<Record<string, unknown>>; dishes: Array<Record<string, unknown>>; groups: Array<Record<string, unknown>>;
    options: Array<Record<string, unknown>>; dishGroups: Array<Record<string, unknown>>;
  };
  let n = idBase;
  const idOf = new Map<string, string>();
  const newId = (key: string): string => {
    const id = `00000000-0000-4000-8000-${(n++).toString(16).padStart(12, '0')}`;
    idOf.set(key, id);
    return id;
  };
  const resolved = (s: PlanStep): Record<string, unknown> => {
    const row: Record<string, unknown> = { ...s.set };
    for (const [col, ref] of Object.entries(s.refs)) row[col] = idOf.get(ref);
    return row;
  };
  const table = { section: out.sections, group: out.groups, option: out.options, dish: out.dishes } as const;
  for (const s of plan.steps) {
    if (s.kind === 'photo' || s.op === 'keep' || s.op === 'skip') continue;
    if (s.kind === 'dish_group') {
      const r = resolved(s);
      out.dishGroups.push({ dish_id: r.dish_id, group_id: r.group_id, position: r.position });
      continue;
    }
    const rows = table[s.kind];
    if (s.op === 'create') {
      const r = resolved(s);
      const base = s.kind === 'dish' ? { asset_id: null } : {};
      rows.push({ ...base, ...r, id: newId(s.key) });
    } else {
      const row = rows.find((r) => r.id === s.id)!;
      Object.assign(row, s.set);
    }
  }
  return out as unknown as ExistingMenu;
}
