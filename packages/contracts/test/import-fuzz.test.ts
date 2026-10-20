// The re-reviews' fuzz (qa/fuzz.ts, round 2; qa/fuzz3.ts, round 3), as a test: random small drafts with name
// collisions, each limit of a group stated or not on its own, dish links with their own limits, answered at random. A
// plan has no structural problem; re-importing the same draft with the same answers changes nothing (Hopa test 1); the
// outcome does not depend on the order of the draft; the menu built never gives a dish two groups of one name, and
// nothing in it is what the database refuses or a guest could never meet (`menuRuleBreaks`: the tables' checks and a
// TypeScript model of `app.guard_dish_addon`), on the first import or on a noisy re-import that changes names, prices,
// options and limits. The seeds QA found are run first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftExceptions, EMPTY_MENU, EXCEPTION_CHOICES, importKey, planApply, validateDraft, type ExistingMenu, type ImportDraft } from '../src/import.ts';
import { applyPlan, copy, dish, draftOf, group, link, menuRuleBreaks, opt, planProblems, section } from './import-fixtures.ts';

/** `r2`: round 2's drafts (limits stated together or not at all; links without limits); `r3`: round 3's. */
type Generator = 'r2' | 'r3';

function fuzz(start: number, n: number, kind: Generator): { problems: string[]; planned: number } {
  let seed = start;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
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
      const options = () => Array.from({ length: k }, (_, o) => { const [ohe, oen] = pick(OPTS); return opt(`g${g}o${o}`, ohe, oen, pick([0, 0, 300, null])); });
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
    if (groups.length > 1 && rnd() < 0.5) (groups[0]!.options[0] as any).opens = 'g1';
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
  const outcome = (p: { steps: readonly { kind: string; key: string; op: string; id: string | null }[] }) =>
    p.steps.filter((s) => s.kind === 'dish' || s.kind === 'section').map((s) => `${s.kind}:${s.key}:${s.op}:${s.id ?? ''}`).sort().join('|');

  const problems: string[] = [];
  let planned = 0;
  for (let i = 0; i < n; i++) {
    const s0 = seed;
    const d = randomDraft();
    if (!validateDraft(d).ok) continue;
    const r1 = planWith(d, EMPTY_MENU, answersFor(d));
    if (!r1.plan) { problems.push(`seed ${s0}: first import refused ${JSON.stringify(r1.errors)}`); continue; }
    planned += 1;
    for (const p of planProblems(r1.plan)) problems.push(`seed ${s0}: ${p}`);
    const once = applyPlan(EMPTY_MENU, r1.plan);
    for (const m of menuProblems(once)) problems.push(`seed ${s0}: ${m}`);
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
    if (kind === 'r3') {
      // the source now says other limits: the links land on the venue's groups, whose limits stay
      for (const g of nz.groups) if (rnd() < 0.3) { g.min = pick([null, 0, 1, 2]); g.max = g.selection === 'single' ? pick([null, 1]) : pick([null, 1, 2, 3, 5]); }
      for (const x of nz.sections) for (const y of x.dishes) if (rnd() < 0.3) y.groups = y.groups.map((a: any) => link(a.group, pick([null, 0, 1, 2, 3]), pick([null, 1, 2, 4])));
    }
    if (!validateDraft(nz).ok) continue;
    const ch: Record<string, string> = { ...r1.choices };
    let r4 = planWith(nz, once, ch);
    for (let k = 0; k < 4 && r4.plan; k++) {
      for (const e of r4.plan.exceptions) ch[`${e.code}@${e.key}`] = pick(EXCEPTION_CHOICES[e.code]);
      r4 = planWith(nz, once, ch);
    }
    if (!r4.plan) {
      if (!r4.errors!.every((e) => e.code === 'nesting_too_deep' || e.code === 'too_many')) problems.push(`seed ${s0}: noisy re-import refused`);
      continue;
    }
    for (const p of planProblems(r4.plan)) problems.push(`seed ${s0}: noisy ${p}`);
    for (const m of menuProblems(applyPlan(once, r4.plan))) problems.push(`seed ${s0}: noisy ${m}`);
  }
  return { problems, planned };
}

test('fuzz, round 2\'s drafts: the seeds QA found (53367808, 1311955456), then 200 more: every property holds', () => {
  assert.deepEqual(fuzz(53367808, 1, 'r2').problems, []);
  assert.deepEqual(fuzz(1311955456, 1, 'r2').problems, []);
  assert.deepEqual(fuzz(1, 200, 'r2').problems, []);
});

test('fuzz, round 3\'s drafts (dish limits, partly stated groups): QA\'s seeds, then 2500 drafts against the database\'s rules', () => {
  // 834265856: a single choice's dish minimum of 2 (now an invalid draft); 146027584: a dish max above a guessed max
  for (const seed of [834265856, 146027584]) assert.deepEqual(fuzz(seed, 1, 'r3').problems, [], `seed ${seed}`);
  const r = fuzz(7, 2500, 'r3');
  assert.deepEqual(r.problems, []);
  assert.ok(r.planned >= 1200, `only ${r.planned} of 2500 drafts were valid and planned`);
});
