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
import {
  draftExceptions, EMPTY_MENU, EXCEPTION_CHOICES, importKey, planApply, validateDraft, type DraftGroup, type ExistingMenu, type ImportDraft, type ImportPlan,
} from '../src/import.ts';
import { applyPlan, copy, dish, draftOf, group, link, menuRuleBreaks, opt, planProblems, section } from './import-fixtures.ts';

/** Another menu of the venue's, sharing no key or name with the generator's drafts. */
const WINES = draftOf([section('x-wines', 'יינות', 'Wines', [dish('x-merlot', 'מרלו', 'Merlot', 3800)], { kind: 'wine' })]);

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
    const once = applyPlan(EMPTY_MENU, r1.plan, d);
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
    const after = applyPlan(once, r4.plan, nz);
    for (const m of [...menuProblems(after), ...unusedCreated(once, after)]) problems.push(`seed ${s0}: noisy ${m}`);
    // the re-read again with the same answers, back to back and after an import of another menu of the venue's (its
    // wines): nothing written (Hopa test 1; `previous` is every applied import's, `mergePrevious`)
    const w = planWith(WINES, after, {});
    if (!w.plan) { problems.push(`seed ${s0}: the wines refused ${JSON.stringify(w.errors)}`); continue; }
    for (const [label, m] of [['back to back', after], ['after the wines', applyPlan(after, w.plan, WINES)]] as const) {
      const again = planWith(nz, m, { ...ch });
      const writes = again.plan ? again.plan.steps.filter((s) => s.op === 'create' || s.op === 'update') : [];
      if (!again.plan) problems.push(`seed ${s0}: the re-read again, ${label}, refused ${JSON.stringify(again.errors)}`);
      if (writes.length) problems.push(`seed ${s0}: the re-read again, ${label}, writes ${writes.map((s) => `${s.kind}:${s.key}:${s.op}`).join(', ')}`);
    }
  }
  return { problems, planned, distinct: drafts.size };
}

test('fuzz: the drafts QA found, replayed with the generator they were found with', () => {
  assert.deepEqual(fuzz(53367808, 1, 'r2', 'lcg').problems, []);
  assert.deepEqual(fuzz(1311955456, 1, 'r2', 'lcg').problems, []);
  // 834265856: a single choice's dish minimum of 2 (now an invalid draft); 146027584: a dish max above a guessed max
  for (const seed of [834265856, 146027584]) assert.deepEqual(fuzz(seed, 1, 'r3', 'lcg').problems, [], `seed ${seed}`);
  // round 10c (QA's fuzz10, R10 L2): a section the re-read left empty, its dishes elsewhere, stays so on the next import
  for (const seed of [299835044, -1496404110, -614020405]) assert.deepEqual(fuzz(seed, 1, 'r4', 'mulberry32').problems, [], `seed ${seed}`);
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

/**
 * Round 10c (QA-M4): drafts where two draft groups land on one venue group (a global match and a dish's own group of
 * the same name), each bringing openers: created options opening the venue's groups, options `add_options` adds, and
 * venue options moved by `new_group`. Every answer at random, `nesting_too_deep` included; whatever is planned must be
 * a menu the database accepts (`menuRuleBreaks`: one nesting level among them).
 */
function fuzzSameTarget(start: number, n: number): { problems: string[]; planned: number; nested: number } {
  let seed = start;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  // the venue's groups, and what a draft's group of that name may hold: the venue's options, and one more
  const KINDS: Array<{ name: [string, string]; options: Array<[string, string]>; extra: [string, string] }> = [
    { name: ['רוטב', 'Sauce'], options: [['איולי', 'Aioli'], ['קטשופ', 'Ketchup']], extra: ['צ׳ילי', 'Chili'] },
    { name: ['עשבים', 'Herbs'], options: [['פטרוזיליה', 'Parsley']], extra: ['נענע', 'Mint'] },
    { name: ['מטבלים', 'Dips'], options: [['טחינה', 'Tahini']], extra: ['חומוס', 'Hummus'] },
    { name: ['תוספת', 'Side'], options: [['צ׳יפס', 'Fries']], extra: ['סלט', 'Salad'] },
  ];
  const randomDraft = (prefix: string, ng: number): ImportDraft => {
    const groups = Array.from({ length: ng }, (_, g) => {
      const k = pick(KINDS);
      const names = [...k.options.filter(() => rnd() < 0.8), ...(rnd() < 0.5 ? [k.extra] : [])];
      if (names.length === 0) names.push(k.options[0]!);
      return group(`${prefix}g${g}`, k.name[0], k.name[1], {
        selection: 'multiple', min: 0, max: 2, options: names.map(([he, en], o) => opt(`${prefix}g${g}o${o}`, he, en, 0)),
      });
    });
    // openers at random (more than one level now and then: the draft's own nesting_too_deep asks)
    for (const g of groups) for (const o of g.options) if (rnd() < 0.35) {
      const other = pick(groups);
      if (other.key !== g.key) Object.assign(o, { opens: other.key, maxQty: 1 });
    }
    const dishes = Array.from({ length: 2 + Math.floor(rnd() * 3) }, (_, d) => dish(`d${d}`, `מנה ${d}`, `Dish ${d}`, 3000, {
      groups: [...new Set(Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => pick(groups).key))].map((key) => link(key)),
    }));
    return draftOf([section('s', 'עיקריות', 'Mains', dishes)], groups);
  };
  const planWith = (d: ImportDraft, m: ExistingMenu, choices: Record<string, string>) => {
    const skip: string[] = [];
    for (let i = 0; i < 30; i++) {
      const r = planApply(d, m, { v: 1, pricesConfirmed: true, choices: choices as never, skip });
      if (r.ok) {
        const fresh = r.value.exceptions.filter((e) => !(`${e.code}@${e.key}` in choices));
        if (fresh.length === 0 || i > 6) return { plan: r.value };
        for (const e of fresh) choices[`${e.code}@${e.key}`] = pick(EXCEPTION_CHOICES[e.code]);
        continue;
      }
      if (keepConflicts(r.errors, choices, skip)) continue;
      const un = r.errors.filter((e) => e.code === 'exception_unresolved');
      if (un.length === 0) return { errors: r.errors };
      for (const e of un) choices[`${e.message}@${e.path}`] = pick(EXCEPTION_CHOICES[e.message as keyof typeof EXCEPTION_CHOICES]);
    }
    return { errors: 'no plan' };
  };
  const problems: string[] = [];
  let planned = 0, nested = 0;
  for (let i = 0; i < n; i++) {
    const s0 = seed;
    const a = randomDraft('a', 1 + Math.floor(rnd() * 3));
    if (!validateDraft(a).ok) continue;
    const r1 = planWith(a, EMPTY_MENU, {});
    if (!r1.plan) continue;
    const m = applyPlan(EMPTY_MENU, r1.plan);
    const b = randomDraft('b', 2 + Math.floor(rnd() * 4));
    if (!validateDraft(b).ok) continue;
    const r2 = planWith(b, m, {});
    if (!r2.plan) {
      const errs = r2.errors as Array<{ code: string }> | string;
      if (typeof errs === 'string' || !errs.every((e) => e.code === 'too_many' || e.code === 'opener_qty')) problems.push(`seed ${s0}: refused ${JSON.stringify(errs).slice(0, 200)}`);
      continue;
    }
    planned++;
    if (r2.plan.exceptions.some((e) => e.code === 'nesting_too_deep' && e.key.startsWith('b'))) nested++;
    for (const p of planProblems(r2.plan)) problems.push(`seed ${s0}: ${p}`);
    for (const x of menuRuleBreaks(applyPlan(m, r2.plan))) problems.push(`seed ${s0}: ${x}`);
  }
  return { problems, planned, nested };
}

test('fuzz, round 10c: two draft groups on one venue group, openers everywhere: every plan keeps one nesting level', () => {
  const r = fuzzSameTarget(101010, 3000);
  assert.deepEqual(r.problems, []);
  assert.ok(r.planned >= 1500, `only ${r.planned} planned`);
  assert.ok(r.nested >= 50, `only ${r.nested} plans asked nesting_too_deep`);
});

/** Round 10e: `answers_conflict` names the answer that writes a venue row another draft option reads otherwise; the
 * owner keeps the venue's for it (`keep_mine`), or, when no answer of theirs is about that option (round 10f: an
 * opener a made row cannot take, an option an added one would take from its row), leaves it out. True when there was
 * one to answer. */
function keepConflicts(errors: readonly { code: string; path: string; message?: string }[], choices: Record<string, string>, skip: string[]): boolean {
  let any = false;
  for (const e of errors) {
    if (e.code !== 'answers_conflict') continue;
    any = true;
    if (e.message === 'price_differs') { choices[`price_differs@${e.path}`] = 'keep_mine'; continue; }
    let kept = false;
    for (const k of Object.keys(choices)) {
      if ((k.startsWith(`${e.message}@${e.path}>`) || k.startsWith(`${e.message}@${e.path}@`)) && choices[k] !== 'keep_mine') { choices[k] = 'keep_mine'; kept = true; }
    }
    if (!kept && !skip.includes(e.path)) skip.push(e.path);
  }
  return any;
}

/**
 * Round 10e (QA-M5): a venue group that two or more draft groups land on, built on purpose. The venue has one Side
 * (and its nested groups) that every dish shares, as an import of it made it; the re-read gives most dishes a Side of
 * their own (named Side too), with options from three names, prices from three values and openers among three nested
 * groups, every answer at random (the writing ones more often). Every plan writes each venue row at most once and adds
 * an option at most once per venue group; the outcome does not depend on the order of the draft's groups; the menu is
 * one the database accepts; and the same draft with the same answers again writes nothing (Hopa test 1).
 */
function fuzzShared(start: number, n: number): { problems: string[]; planned: number; shared: number; conflicts: number } {
  let seed = start;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const OPTS: Array<[string, string]> = [['צ׳יפס', 'Fries'], ['סלט', 'Salad'], ['אורז', 'Rice']];
  const NESTED: Array<[string, string, Array<[string, string]>]> = [
    ['רוטב', 'Sauce', [['איולי', 'Aioli'], ['קטשופ', 'Ketchup']]],
    ['מטבלים', 'Dips', [['טחינה', 'Tahini'], ['חומוס', 'Hummus']]],
    ['עשבים', 'Herbs', [['פטרוזיליה', 'Parsley'], ['נענע', 'Mint']]],
  ];
  const DISHES: Array<[string, string]> = [['המבורגר', 'Burger'], ['סטייק', 'Steak'], ['שניצל', 'Schnitzel']];
  const nestedGroups = (prefix: string, count: number): DraftGroup[] => NESTED.slice(0, count).map(([he, en, os], i) => {
    const names = os.filter(() => rnd() < 0.8);
    if (names.length === 0) names.push(os[0]!);
    return group(`${prefix}n${i}`, he, en, { selection: 'multiple', min: 0, max: 2, options: names.map(([ohe, oen], j) => opt(`${prefix}n${i}o${j}`, ohe, oen, 0)) });
  });
  const side = (key: string, prefix: string, nests: number): DraftGroup => {
    const names = OPTS.filter(() => rnd() < 0.7);
    if (names.length === 0) names.push(pick(OPTS));
    return group(key, 'תוספת', 'Side', {
      selection: 'multiple', min: 0, max: 3,
      options: names.map(([he, en], j) => opt(`${key}o${j}`, he, en, pick([0, 500, 900]), rnd() < 0.35 ? { opens: `${prefix}n${Math.floor(rnd() * nests)}`, maxQty: 1 } : {})),
    });
  };
  const WRITES: Partial<Record<string, string>> = { group_changed: 'add_options', opens_changed: 'new_group', price_differs: 'take_new' };
  const answer = (code: keyof typeof EXCEPTION_CHOICES): string => (WRITES[code] && rnd() < 0.6 ? WRITES[code]! : pick(EXCEPTION_CHOICES[code]));
  let conflicted = false;
  const planWith = (d: ImportDraft, m: ExistingMenu, choices: Record<string, string>, skip: string[] = []) => {
    for (let i = 0; i < 40; i++) {
      const r = planApply(d, m, { v: 1, pricesConfirmed: true, choices: choices as never, skip });
      if (r.ok) {
        const fresh = r.value.exceptions.filter((e) => !(`${e.code}@${e.key}` in choices));
        if (fresh.length === 0 || i > 8) return { plan: r.value };
        for (const e of fresh) choices[`${e.code}@${e.key}`] = answer(e.code);
        continue;
      }
      if (keepConflicts(r.errors, choices, skip)) { conflicted = true; continue; }
      const un = r.errors.filter((e) => e.code === 'exception_unresolved');
      if (un.length === 0) return { errors: r.errors };
      for (const e of un) choices[`${e.message}@${e.path}`] = pick(EXCEPTION_CHOICES[e.message as keyof typeof EXCEPTION_CHOICES]);
    }
    return { errors: 'no plan' as const };
  };
  const writes = (p: ImportPlan): string => p.steps.filter((s) => (s.kind === 'group' || s.kind === 'option') && (s.op === 'create' || s.op === 'update'))
    .map((s) => { const { position: _, ...set } = s.set as Record<string, unknown>; return `${s.kind}|${s.op}|${s.id ?? s.key}|${JSON.stringify(set)}|${JSON.stringify(s.refs)}`; })
    .sort().join('\n');
  const problems: string[] = [];
  let planned = 0, shared = 0, conflicts = 0;
  for (let i = 0; i < n; i++) {
    const s0 = seed;
    const base = draftOf([section('s', 'עיקריות', 'Mains', DISHES.map(([he, en], k) => dish(`d${k}`, he, en, 5000, { groups: [link('aside')] })))],
      [side('aside', 'a', 2), ...nestedGroups('a', 2)]);
    if (!validateDraft(base).ok) continue;
    const r0 = planWith(base, EMPTY_MENU, {});
    if (!r0.plan) continue;
    const m = applyPlan(EMPTY_MENU, r0.plan, base);
    const own = DISHES.map(() => rnd() < 0.75);
    const d = draftOf([section('s', 'עיקריות', 'Mains', DISHES.map(([he, en], k) => dish(`d${k}`, he, en, 5000, { groups: [link(own[k] ? `rside${k}` : 'rside')] })))],
      [side('rside', 'r', 3), ...DISHES.map((_, k) => side(`rside${k}`, 'r', 3)), ...nestedGroups('r', 3)]);
    if (!validateDraft(d).ok) continue;
    conflicted = false;
    const ch: Record<string, string> = {};
    const sk: string[] = [];
    const r = planWith(d, m, ch, sk);
    if (!r.plan) {
      problems.push(`seed ${s0}: refused ${JSON.stringify(r.errors).slice(0, 200)}`);
      continue;
    }
    planned++;
    if (conflicted) conflicts++;
    const p = r.plan;
    const ids = p.steps.filter((s) => s.kind === 'group' && s.id !== null).map((s) => s.id);
    if (new Set(ids).size < ids.length) shared++;
    for (const x of planProblems(p)) problems.push(`seed ${s0}: ${x}`);
    const added = new Set<string>();
    for (const s of p.steps) {
      if (s.kind !== 'option' || s.op !== 'create') continue;
      const set = s.set as { group_id?: string; name_he: string; name_en: string };
      if (set.group_id === undefined) continue;
      const k = `${set.group_id}|${importKey(set.name_he)}|${importKey(set.name_en)}`;
      if (added.has(k)) problems.push(`seed ${s0}: ${set.name_en} added twice to one venue group`);
      added.add(k);
    }
    const after = applyPlan(m, p, d);
    for (const x of menuRuleBreaks(after)) problems.push(`seed ${s0}: ${x}`);
    // the draft's groups in another order: the same outcome, or the same refusal
    const sh: ImportDraft = { ...copy(d), groups: [...d.groups].reverse() };
    const r2 = planApply(sh, m, { v: 1, pricesConfirmed: true, choices: { ...ch } as never, skip: [...sk] });
    if (!r2.ok) problems.push(`seed ${s0}: refused in another order ${JSON.stringify(r2.errors).slice(0, 200)}`);
    else if (writes(r2.value) !== writes(p)) problems.push(`seed ${s0}: the outcome depends on the order of the draft's groups`);
    // Hopa test 1: the same draft with every answer the owner gave writes nothing, and asks nothing new (round 10f)
    const again = planApply(d, after, { v: 1, pricesConfirmed: true, choices: { ...ch } as never, skip: [...sk] });
    if (!again.ok) problems.push(`seed ${s0}: the re-import refused ${JSON.stringify(again.errors).slice(0, 200)}`);
    else {
      const w = again.value.steps.filter((s) => s.op === 'create' || s.op === 'update');
      if (w.length) problems.push(`seed ${s0}: the re-import writes ${w.map((s) => `${s.kind}:${s.key}:${s.op}`).join(', ')}`);
      const before = new Set(p.exceptions.map((e) => `${e.code}@${e.key}`));
      const anew = again.value.exceptions.filter((e) => !before.has(`${e.code}@${e.key}`)).map((e) => `${e.code}@${e.key}`);
      if (anew.length) problems.push(`seed ${s0}: the re-import asks anew ${anew.join(', ')}`);
    }
  }
  return { problems, planned, shared, conflicts };
}

test('fuzz, round 10e (QA-M5): two or more draft groups on one venue group, on purpose: each row written once, order-free, Hopa', () => {
  const r = fuzzShared(10105, 1500);
  assert.deepEqual(r.problems, []);
  assert.ok(r.planned >= 1400, `only ${r.planned} planned`);
  assert.ok(r.shared >= 1300, `only ${r.shared} plans with a venue group shared`);
  assert.ok(r.conflicts >= 100, `only ${r.conflicts} plans refused a conflict first`);
});
