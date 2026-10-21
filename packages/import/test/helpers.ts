import assert from 'node:assert/strict';
import { DRAFT_ROOT, draftExceptions, EMPTY_MENU, planApply, validateDraft, type ImportDraft, type Lang } from '@mana/contracts';
// the contracts' in-memory executor of a plan, the way apply_import writes the tables
import { applyPlan } from '../../contracts/test/import-fixtures.ts';
import type { ReadResult } from '../src/index.ts';

/** The draft passes the contracts' validator (what save_import_draft runs first). */
export function valid(r: ReadResult): ImportDraft {
  const v = validateDraft(r.draft);
  assert.ok(v.ok, JSON.stringify(!v.ok && v.errors));
  return r.draft;
}

/** The draft's exceptions as `code@name` (the node's English name, else its Hebrew one), in their order. */
export function exceptions(d: ImportDraft, langs?: readonly Lang[]): string[] {
  const names = new Map<string, string>();
  for (const s of d.sections) { names.set(s.key, s.name.en || s.name.he); for (const x of s.dishes) names.set(x.key, x.name.en || x.name.he); }
  for (const g of d.groups) { names.set(g.key, g.name.en || g.name.he); for (const o of g.options) names.set(o.key, o.name.en || o.name.he); }
  // the whole draft's exceptions (`DRAFT_ROOT`) say how many nodes they stand for
  return draftExceptions(d, langs ? { langs } : {}).map((e) => `${e.code}@${names.get(e.key) ?? e.key}${e.key === DRAFT_ROOT ? `×${e.count}` : ''}`);
}

/** A readable outline: sections, their dishes with prices, and every group with its options. */
export function outline(d: ImportDraft): string[] {
  const out: string[] = [];
  const name = (t: { he: string; en: string }) => [t.he, t.en].filter((x) => x !== '').join(' / ');
  const groupName = new Map(d.groups.map((g) => [g.key, name(g.name)] as const));
  for (const s of d.sections) {
    out.push(`# ${name(s.name)} (${s.kind})`);
    for (const x of s.dishes) {
      const price = x.price === null ? (x.priceText === null ? '-' : `?${x.priceText}`) : String(x.price);
      const extra = [x.tags.length ? `tags:${x.tags.join(',')}` : '', x.groups.length ? `groups:${x.groups.map((a) => groupName.get(a.group)).join(',')}` : ''].filter(Boolean);
      out.push(`${name(x.name)} ${price}${extra.length ? ' ' + extra.join(' ') : ''}`);
    }
  }
  for (const g of d.groups) {
    const opts = g.options.map((o) => `${name(o.name)}${o.price ? ` +${o.price}` : ''}${o.opens ? ` >${groupName.get(o.opens)}` : ''}${o.default ? ' *' : ''}`);
    out.push(`[${name(g.name)}] ${g.selection} ${g.min ?? '?'}-${g.max ?? '?'}: ${opts.join(', ')}`);
  }
  return out;
}

const yes = { v: 1 as const, pricesConfirmed: true, choices: {} };

/**
 * Hopa test 1 through the readers: apply the first reading to an empty menu, read the same input again, and the plan
 * for the second reading creates and updates nothing. `choices` answer the draft's `fix` exceptions.
 */
export function reimportCreatesNothing(read: () => ReadResult, choices: Record<string, string> = {}): void {
  const decisions = { ...yes, choices } as Parameters<typeof planApply>[2];
  const first = planApply(read().draft, EMPTY_MENU, decisions);
  assert.ok(first.ok, JSON.stringify(!first.ok && first.errors));
  const menu = applyPlan(EMPTY_MENU, first.value);
  const again = planApply(read().draft, menu, decisions);
  assert.ok(again.ok, JSON.stringify(!again.ok && again.errors));
  const changed = again.value.steps.filter((s) => s.op === 'create' || s.op === 'update');
  assert.deepEqual(changed.map((s) => `${s.kind}:${s.key}:${s.op}`), []);
}

/** A choice for every `fix` exception of a draft (the first allowed answer), so a plan can be made. */
export function answerFixes(d: ImportDraft): Record<string, string> {
  const choices: Record<string, string> = {};
  const first: Record<string, string> = {
    price_missing: 'no_price', price_unreadable: 'no_price', option_price_unreadable: 'free', limits_unreachable: 'clamp', section_duplicate: 'merge',
    dish_duplicate: 'keep_both', nesting_too_deep: 'unlink', too_many: 'skip',
  };
  for (const e of draftExceptions(d)) if (e.severity === 'fix') choices[`${e.code}@${e.key}`] = first[e.code]!;
  return choices;
}

/**
 * The CPU time of the fastest of three runs, and its result: CPU time, not wall time, and the fastest run, so a busy
 * machine (other processes, the first run's compilation) does not count as the code's own cost.
 */
export function fastest<T>(f: () => T): { ms: number; r: T } {
  let ms = Infinity, r: T | undefined;
  for (let i = 0; i < 3; i++) {
    const c0 = process.cpuUsage();
    r = f();
    const c = process.cpuUsage(c0);
    ms = Math.min(ms, (c.user + c.system) / 1000);
  }
  return { ms, r: r! };
}

/** A seeded generator (the same numbers every run), so a fuzz test is a test. */
export function seeded(seed: number): (n: number) => number {
  let s = seed >>> 0;
  return (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) % n; };
}
