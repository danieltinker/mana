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
export const draftOf = (sections: DraftSection[], groups: DraftGroup[] = [], o: Partial<ImportDraft> = {}): ImportDraft =>
  ({ v: 1, source: 'wolt_text', sections, groups, dropped: 0, ...o });

/** The base draft: two sections, three dishes, three groups (one nested), as a Wolt-text reader would produce it. */
export function bistroDraft(): ImportDraft {
  return draftOf(
    [
      section('s-mains', 'עיקריות', 'Mains', [
        dish('d-schnitzel', 'שניצל', 'Schnitzel', 6400, { groups: [link('g-side')] }),
        dish('d-burger', 'המבורגר', 'Burger', 7200, { tags: ['spicy'], groups: [link('g-side'), link('g-extras')] }),
      ]),
      section('s-drinks', 'שתייה', 'Drinks', [dish('d-lemonade', 'לימונדה', 'Lemonade', 1800)], { kind: 'drinks' }),
    ],
    [
      group('g-side', 'תוספת', 'Side of choice', { options: [opt('o-fries', 'צ׳יפס', 'Fries', 0, { opens: 'g-sauce' }), opt('o-salad', 'סלט', 'Salad', 0)] }),
      group('g-sauce', 'רוטב', 'Sauce', { options: [opt('o-aioli', 'איולי', 'Aioli', 0), opt('o-ketchup', 'קטשופ', 'Ketchup', 0)] }),
      group('g-extras', 'תוספות', 'Extras', {
        selection: 'multiple', min: null, max: null, options: [opt('o-cheese', 'גבינה', 'Cheese', 300, { maxQty: 2 }), opt('o-egg', 'ביצה', 'Egg', 400)],
      }),
    ],
  );
}

/** A deep copy that a test may change. */
export const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const REF_KIND: Record<string, PlanStep['kind']> = { section_id: 'section', group_id: 'group', opens_group_id: 'group', dish_id: 'dish' };

/**
 * Checks what every plan must be: no op but create, update, keep or skip; `set` only on create and update (never
 * empty on update); an id exactly on update and keep; a reason exactly on skip; every ref names a node the same plan
 * creates, of the right kind, earlier in apply order; no step key twice for one kind.
 */
export function planProblems(plan: ImportPlan): string[] {
  const out: string[] = [];
  const created = new Map<string, PlanStep['kind']>();
  const seen = new Set<string>();
  for (const s of plan.steps) {
    if (seen.has(`${s.kind}:${s.key}`)) out.push(`${s.kind}:${s.key}: twice`);
    seen.add(`${s.kind}:${s.key}`);
    if (!['create', 'update', 'keep', 'skip'].includes(s.op)) out.push(`${s.key}: op ${s.op}`);
    if ((s.op === 'keep' || s.op === 'skip') && Object.keys(s.set).length > 0) out.push(`${s.key}: set on ${s.op}`);
    if (s.op === 'update' && Object.keys(s.set).length === 0 && Object.keys(s.refs).length === 0) out.push(`${s.key}: empty update`);
    // the type already promises these; the plan arrives as JSON from the database too, so check them at run time
    const loose = s as { op: string; id: string | null; key: string };
    if ((loose.op === 'update' || loose.op === 'keep') && loose.id === null) out.push(`${loose.key}: ${loose.op} without id`);
    if ((loose.op === 'create' || loose.op === 'skip') && loose.id !== null) out.push(`${loose.key}: id on ${loose.op}`);
    if ((s.op === 'skip') !== (s.reason !== null)) out.push(`${s.key}: reason on ${s.op}`);
    for (const [col, ref] of Object.entries(s.refs as Record<string, string>)) {
      if (created.get(ref) !== REF_KIND[col]) out.push(`${s.key}: ${col} → ${ref} is not a ${REF_KIND[col]} created earlier`);
      if (col in s.set) out.push(`${s.key}: ${col} both set and ref`);
    }
    if (s.op === 'create' && !s.key.includes('@')) created.set(s.key, s.kind);
  }
  return out;
}

let nextId = 0xa00000000000;
const freshId = (): string => `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

type Rows = { -readonly [K in keyof ExistingMenu]: Array<Record<string, unknown>> };

/** Applies a plan in memory, as `apply_import` writes the tables (ids are made up, new on every call). */
export function applyPlan(menu: ExistingMenu, plan: ImportPlan): ExistingMenu {
  const out = copy(menu) as unknown as Rows;
  const idOf = new Map<string, string>();
  const resolved = (set: object, refs: object): Record<string, unknown> => {
    const row: Record<string, unknown> = { ...set };
    for (const [col, ref] of Object.entries(refs as Record<string, string>)) row[col] = idOf.get(ref);
    return row;
  };
  const table = { section: out.sections, group: out.groups, option: out.options, dish: out.dishes, dish_group: out.dishGroups, photo: out.assets } as const;
  for (const s of plan.steps) {
    if (s.op === 'keep' || s.op === 'skip') continue;
    const rows = table[s.kind];
    if (s.op === 'create') {
      const id = freshId();
      const r = resolved(s.set, s.refs);
      if (!s.key.includes('@') && s.kind !== 'photo') idOf.set(s.key, id);
      if (s.kind === 'dish') rows.push({ asset_id: null, ...r, id });
      else if (s.kind === 'photo') rows.push({ id, dish_id: r.dish_id, status: 'uploaded' });
      else rows.push({ ...r, id });
    } else Object.assign(rows.find((r) => r.id === s.id)!, resolved(s.set, s.refs));
  }
  return out as unknown as ExistingMenu;
}
