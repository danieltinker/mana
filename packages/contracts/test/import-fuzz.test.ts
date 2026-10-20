// The re-reviews' fuzz (qa/fuzz.ts, round 2; qa/fuzz3.ts, round 3; round 4's quantities and openers), as a test:
// random small drafts with name collisions, each limit of a group stated or not on its own, dish links with their own
// limits, options a guest may take more than once, answered at random. A plan has no structural problem; re-importing
// the same draft with the same answers changes nothing (Hopa test 1); the outcome does not depend on the order of the
// draft; the menu built never gives a dish two groups of one name, and nothing in it is what the database refuses or a
// guest could never meet (`menuRuleBreaks`: the tables' checks and TypeScript models of `app.guard_dish_addon` and
// `app.guard_nesting`), on the first import or on a noisy re-import that changes names, prices, options, limits and
// openers. The seeds QA found are replayed with the generator they were found with; the bulk runs use mulberry32 (the
// old generator, `(seed * 1103515245 + 12345) % 2^31` in doubles, falls into a short cycle) and count distinct drafts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftExceptions, EMPTY_MENU, EXCEPTION_CHOICES, importKey, planApply, validateDraft, type ExistingMenu, type ImportDraft } from '../src/import.ts';
import { applyPlan, copy, dish, draftOf, group, link, menuRuleBreaks, opt, planProblems, section } from './import-fixtures.ts';

/** `r2`: round 2's drafts (limits stated together or not at all; links without limits); `r3`: round 3's (limits each
 * on its own, dish links with limits); `r4`: round 3's with options taken up to 3 times, and openers added on re-import. */
type Generator = 'r2' | 'r3' | 'r4';
/** `lcg`: the generator QA's seeds were found with; `mulberry32`: 32-bit integer arithmetic that does not cycle. */
type Random = 'lcg' | 'mulberry32';

function fuzz(start: number, n: number, kind: Generator, random: Random): { problems: string[]; planned: number; distinct: number } {
  let seed = start;
  const rnd = random === 'lcg'
    ? () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    : () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const shuffle = <T>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; };
  const SECTIONS: Array<[string, string]> = [['עיקריות', 'Mains'], ['ילדים', 'Kids'], ['ראשונות', 'Starters'], ['שתייה', 'Drinks']];
  const DISHES: Array<[string, string]> = [['סלט', 'Salad'], ['המבורגר', 'Burger'], ['שניצל', 'Schnitzel'], ['צ׳יפס', 'Fries'], ['לימונדה', 'Lemonade'], ['קלאסי', 'Classic']];
  const GROUPS: Array<[string, string]> = [['תוספת', 'Side'], ['רוטב', 'Sauce'], ['תוספות', 'Extras']];
  const OPTS: Array<[string, string]> = [['צ׳יפס', 'Fries'], ['סלט', 'Salad'], ['אורז', 'Rice'], ['איולי', 'Aioli']];
  const randomDraft = (): ImportDraft => {
    const groups = Array.from({ length: Math.floor(rnd() * 4) }, (_, g) => {
      const [he, en] = pick(GROUPS);
      const k = 1 + Math.floor(rnd() * 3);
      const selection = rnd() < 0.5 ? 'single' : 'multiple';
      const stated = rnd() < 0.5;
      const options = () => Array.from({ length: k }, (_, o) => {
        const [ohe, oen] = pick(OPTS);
        return opt(`g${g}o${o}`, ohe, oen, pick([0, 0, 300, null]), kind === 'r4' ? { maxQty: pick([1, 1, 2, 3]) } : {});
      });
      if (kind === 'r2') {
        return group(`g${g}`, he, en, {
          selection, min: stated ? (selection === 'single' ? 1 : Math.floor(rnd() * 3)) : null, max: stated ? (selection === 'single' ? 1 : 3) : null, options: options(),
        });
      }
      // each limit stated or not on its own
      return group(`g${g}`, he, en, {
        selection, min: stated && rnd() < 0.7 ? (selection === 'single' ? pick([0, 1]) : Math.floor(rnd() * 3)) : null,
        max: stated && rnd() < 0.7 ? (selection === 'single' ? 1 : pick([2, 3])) : null, options: options(),
      });
    });
    if (groups.length > 1 && rnd() < 0.5) Object.assign(groups[0]!.options[0]!, { opens: 'g1', maxQty: 1 });
    const sections = Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, s) => {
      const [he, en] = pick(SECTIONS);
      return section(`s${s}`, he, en, Array.from({ length: 1 + Math.floor(rnd() * 4) }, (_, d) => {
        const [dhe, den] = pick(DISHES);
        const gs = shuffle(groups.map((g) => g.key)).slice(0, Math.floor(rnd() * 3));
        const links = kind === 'r2' ? gs.map((k2) => link(k2)) : gs.map((k2) => (rnd() < 0.5 ? link(k2) : link(k2, pick([null, 0, 1, 2]), pick([null, 1, 2, 4]))));
        return dish(`s${s}d${d}`, dhe, den, pick([3000, 4200, 0, null]), { groups: links });
      }), { kind: en === 'Drinks' ? 'drinks' : 'food' });
    });
    return draftOf(sections, groups);
  };
  const answersFor = (d: ImportDraft): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const e of draftExceptions(d)) if (e.severity === 'fix') out[`${e.code}@${e.key}`] = pick(EXCEPTION_CHOICES[e.code]);
    return out;
  };
  const planWith = (d: ImportDraft, m: ExistingMenu, choices: Record<string, string>) => {
    for (let i = 0; i < 20; i++) {
      const r = planApply(d, m, { v: 1, pricesConfirmed: true, choices: choices as never });
      if (r.ok) return { plan: r.value, choices };
      const un = r.errors.filter((e) => e.code === 'exception_unresolved');
      if (un.length === 0) return { errors: r.errors, choices };
      for (const e of un) choices[`${e.message}@${e.path}`] = pick(EXCEPTION_CHOICES[e.message as keyof typeof EXCEPTION_CHOICES]);
    }
    throw new Error('no plan');
  };
  const menuProblems = (m: ExistingMenu): string[] => {
    const out: string[] = [...menuRuleBreaks(m)];
    for (const d of m.dishes) {
      const gs = m.dishGroups.filter((l) => l.dish_id === d.id).map((l) => m.groups.find((g) => g.id === l.group_id)!);
      for (let i = 0; i < gs.length; i++) for (let j = 0; j < i; j++) {
        const a = gs[i]!, b = gs[j]!;
        if (a.selection === b.selection && ((importKey(a.name_he) !== '' && importKey(a.name_he) === importKey(b.name_he)) ||
          (importKey(a.name_en) !== '' && importKey(a.name_en) === importKey(b.name_en)))) out.push(`dish ${d.name_en} has two groups ${a.name_en}`);
      }
    }
    return out;
  };
  /** A group the import created that no dish uses and no option opens (a dish's merged link must not leave one). */
  const unusedCreated = (before: ExistingMenu, after: ExistingMenu): string[] => {
    const old = new Set(before.groups.map((g) => g.id));
    const used = new Set([...after.dishGroups.map((l) => l.group_id), ...after.options.map((o) => o.opens_group_id)]);
    return after.groups.filter((g) => !old.has(g.id) && !used.has(g.id)).map((g) => `group ${g.name_en || g.name_he} created, used by nothing`);
  };
  const outcome = (p: { steps: readonly { kind: string; key: string; op: string; id: string | null }[] }) =>
    p.steps.filter((s) => s.kind === 'dish' || s.kind === 'section').map((s) => `${s.kind}:${s.key}:${s.op}:${s.id ?? ''}`).sort().join('|');

  const problems: string[] = [];
  const drafts = new Set<string>();
  let planned = 0;
  for (let i = 0; i < n; i++) {
    const s0 = seed;
    const d = randomDraft();
    drafts.add(JSON.stringify(d));
    if (!validateDraft(d).ok) continue;
    const r1 = planWith(d, EMPTY_MENU, answersFor(d));
    if (!r1.plan) { problems.push(`seed ${s0}: first import refused ${JSON.stringify(r1.errors)}`); continue; }
    planned += 1;
    for (const p of planProblems(r1.plan)) problems.push(`seed ${s0}: ${p}`);
    const once = applyPlan(EMPTY_MENU, r1.plan);
    for (const m of [...menuProblems(once), ...unusedCreated(EMPTY_MENU, once)]) problems.push(`seed ${s0}: ${m}`);
    const r2 = planWith(d, once, { ...r1.choices });
    if (!r2.plan) { problems.push(`seed ${s0}: re-import refused`); continue; }
    const changed = r2.plan.steps.filter((s) => s.op === 'create' || s.op === 'update');
    if (changed.length) problems.push(`seed ${s0}: re-import changes ${changed.map((s) => `${s.kind}:${s.key}:${s.op}`).join(', ')}`);
    const sh = copy(d) as any;
    sh.sections = shuffle(sh.sections).map((x: any) => ({ ...x, dishes: shuffle(x.dishes) }));
    sh.groups = shuffle(sh.groups).map((g: any) => ({ ...g, options: shuffle(g.options) }));
    const exKey = (x: ImportDraft) => draftExceptions(x).map((e) => `${e.code}@${e.key}`).sort().join(',');
    const r3 = planWith(sh, once, { ...r2.choices });
    if (r3.plan && outcome(r3.plan) !== outcome(r2.plan) && exKey(sh) === exKey(d)) problems.push(`seed ${s0}: re-import depends on draft order`);
    const nz = copy(d) as any;
    for (const x of nz.sections) if (rnd() < 0.4) x.name = { he: x.name.he + ' חדש', en: x.name.en + ' new' };
    for (const x of nz.sections) for (const y of x.dishes) if (rnd() < 0.3) y.price = pick([3000, 4200, 5000, null]);
    for (const g of nz.groups) if (rnd() < 0.3) g.options.push(opt(g.key + 'ox', pick(OPTS)[0], pick(OPTS)[1], 0));
    if (kind !== 'r2') {
      // the source now says other limits: the links land on the venue's groups, whose limits stay
      for (const g of nz.groups) if (rnd() < 0.3) { g.min = pick([null, 0, 1, 2]); g.max = g.selection === 'single' ? pick([null, 1]) : pick([null, 1, 2, 3, 5]); }
      for (const x of nz.sections) for (const y of x.dishes) if (rnd() < 0.3) y.groups = y.groups.map((a: any) => link(a.group, pick([null, 0, 1, 2, 3]), pick([null, 1, 2, 4])));
    }
    if (kind === 'r4' && nz.groups.length > 1 && rnd() < 0.5) {
      // and an option the venue already has (perhaps taken up to 3 times) now opens another group
      const [a, b] = shuffle(nz.groups as any[]);
      Object.assign(pick(a.options as any[]), { opens: b.key, maxQty: 1 });
    }
    if (!validateDraft(nz).ok) continue;
    const ch: Record<string, string> = { ...r1.choices };
    let r4 = planWith(nz, once, ch);
    for (let k = 0; k < 4 && r4.plan; k++) {
      for (const e of r4.plan.exceptions) ch[`${e.code}@${e.key}`] = pick(EXCEPTION_CHOICES[e.code]);
      r4 = planWith(nz, once, ch);
    }
    if (!r4.plan) {
      if (!r4.errors!.every((e) => e.code === 'nesting_too_deep' || e.code === 'too_many' || e.code === 'opener_qty')) {
        problems.push(`seed ${s0}: noisy re-import refused ${JSON.stringify(r4.errors)}`);
      }
      continue;
    }
    for (const p of planProblems(r4.plan)) problems.push(`seed ${s0}: noisy ${p}`);
    const after = applyPlan(once, r4.plan);
    for (const m of [...menuProblems(after), ...unusedCreated(once, after)]) problems.push(`seed ${s0}: noisy ${m}`);
  }
  return { problems, planned, distinct: drafts.size };
}

test('fuzz: the drafts QA found, replayed with the generator they were found with', () => {
  assert.deepEqual(fuzz(53367808, 1, 'r2', 'lcg').problems, []);
  assert.deepEqual(fuzz(1311955456, 1, 'r2', 'lcg').problems, []);
  // 834265856: a single choice's dish minimum of 2 (now an invalid draft); 146027584: a dish max above a guessed max
  for (const seed of [834265856, 146027584]) assert.deepEqual(fuzz(seed, 1, 'r3', 'lcg').problems, [], `seed ${seed}`);
});

test('fuzz, round 2\'s drafts: 300 distinct drafts, every property holds', () => {
  const r = fuzz(1, 300, 'r2', 'mulberry32');
  assert.deepEqual(r.problems, []);
  assert.ok(r.distinct >= 290, `only ${r.distinct} distinct drafts`);
});

test('fuzz, round 4\'s drafts (dish limits, partly stated groups, quantities, new openers): 2500 drafts against the database\'s rules', () => {
  const r = fuzz(7, 2500, 'r4', 'mulberry32');
  assert.deepEqual(r.problems, []);
  assert.ok(r.distinct >= 2400, `only ${r.distinct} distinct drafts of 2500`);
  assert.ok(r.planned >= 1200, `only ${r.planned} of 2500 drafts were valid and planned`);
});
