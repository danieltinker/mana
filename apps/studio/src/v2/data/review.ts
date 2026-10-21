// The import preview (F03 step 3; ADR-006), pure: what was read, the exceptions the owner fixes or decides in place, the
// plan that applying would run, and what still stops it. Every rule is the contracts': `draftExceptions` (the draft's
// own, which save_import_draft stores too), `planApply` (the plan, and the exceptions that depend on the venue's menu),
// `EXCEPTION_CHOICES` (the answers). Nothing here reads or writes the database; the screen keeps the owner's answers and
// edits, and `apply_import` runs exactly the plan shown (the database's `app.plan_import` is `planApply`'s twin).
//
// Two kinds of fixing in place:
// - deciding: a choice from `EXCEPTION_CHOICES` (leave the dish out, no price for now, keep both…), filed under the
//   exception's id in `ImportDecisions.choices`;
// - editing the draft: a price typed for a dish or a choice (`withDishPrice`, `withOptionPrice`), after which the
//   exception is gone. An edited draft is saved again (save_import_draft) before it is applied: apply_import applies
//   only the draft the database holds.
import {
  DRAFT_ROOT, draftCounts, draftExceptions, EXCEPTION_CHOICES, exceptionId, LIMITS, planApply, SKIP_REASONS,
  type ExistingMenu, type ImportChoice, type ImportDecisions, type ImportDraft, type ImportException, type ImportExceptionCode, type ImportPlan,
  type Issue, type Lang, type PlanKind, type PlanOp, type SkipReason, type Text,
} from '@mana/contracts';

export const NO_DECISIONS: ImportDecisions = { v: 1, pricesConfirmed: false, choices: {}, skip: [] };

/** What an exception is about, by the draft's own names (a plan exception about one of the venue's groups names it too). */
export type About = {
  readonly kind: 'draft' | 'section' | 'dish' | 'group' | 'option' | 'link';
  /** The node's name; null for the whole draft. */
  readonly name: Text | null;
  /** Where it is: the dish's section, the option's group, the link's dish. */
  readonly within: Text | null;
  /** The venue's group a plan exception points at (`<node>@<group id>`), when there is one. */
  readonly theirs: Text | null;
};

/** One line of the exceptions list. */
export type ExceptionRow = {
  readonly id: string;
  readonly e: ImportException;
  readonly about: About;
  /** The answers the owner may give, the default first for a `check`. */
  readonly choices: readonly ImportChoice[];
  /** The owner's own answer, if any. */
  readonly choice: ImportChoice | null;
  /** What applying will do: the owner's answer, or a check's default; null while a `fix` waits for its answer. */
  readonly effective: ImportChoice | null;
  /** A `fix` without an answer: applying waits for it. */
  readonly open: boolean;
  /** Raised by the plan (it depends on what the venue already has). */
  readonly plan: boolean;
  /** Can be fixed by typing the missing value in place. */
  readonly edit: 'dish_price' | 'option_price' | null;
  /** The plan refuses the owner's answer here, and why (`opener_qty`: `new_group` on a choice taken more than once). */
  readonly refused: string | null;
};

const PATH = /^sections\[(\d+)\](?:\.dishes\[(\d+)\](?:\.groups\[(\d+)\])?)?$|^groups\[(\d+)\](?:\.options\[(\d+)\])?$/;
const text = (he: string, en: string): Text => ({ he, en });

/** What a key and path of the draft point at. */
export function aboutOf(draft: ImportDraft, e: Pick<ImportException, 'key' | 'path'>, existing?: Pick<ExistingMenu, 'groups'>): About {
  if (e.key === DRAFT_ROOT) return { kind: 'draft', name: null, within: null, theirs: null };
  const at = e.key.indexOf('@');
  const node = at >= 0 ? e.key.slice(0, at) : e.key;
  const gid = at >= 0 ? e.key.slice(at + 1) : null;
  const g = gid ? existing?.groups.find((x) => x.id === gid) : null;
  const theirs = g ? text(g.name_he, g.name_en) : null;
  // a link: `<dish>><group>` or `<option>><group>`
  const gt = node.indexOf('>');
  if (gt >= 0) {
    const owner = node.slice(0, gt), group = node.slice(gt + 1);
    const grp = draft.groups.find((x) => x.key === group);
    const dish = draft.sections.flatMap((s) => s.dishes).find((d) => d.key === owner);
    const opt = dish ? null : draft.groups.flatMap((x) => x.options).find((o) => o.key === owner);
    return { kind: 'link', name: grp ? grp.name : null, within: dish ? dish.name : opt ? opt.name : null, theirs };
  }
  const m = PATH.exec(e.path);
  if (m) {
    if (m[1] !== undefined) {
      const s = draft.sections[+m[1]];
      if (s && m[2] === undefined) return { kind: 'section', name: s.name, within: null, theirs };
      const d = s?.dishes[+m[2]!];
      if (d && m[3] === undefined) return { kind: 'dish', name: d.name, within: s!.name, theirs };
      const link = d?.groups[+m[3]!];
      const grp = link ? draft.groups.find((x) => x.key === link.group) : null;
      if (d) return { kind: 'link', name: grp ? grp.name : null, within: d.name, theirs };
    } else {
      const grp = draft.groups[+m[4]!];
      if (grp && m[5] === undefined) return { kind: 'group', name: grp.name, within: null, theirs };
      const o = grp?.options[+m[5]!];
      if (o) return { kind: 'option', name: o.name, within: grp!.name, theirs };
    }
  }
  // by key alone (a plan exception without a path we know)
  for (const s of draft.sections) {
    if (s.key === node) return { kind: 'section', name: s.name, within: null, theirs };
    for (const d of s.dishes) if (d.key === node) return { kind: 'dish', name: d.name, within: s.name, theirs };
  }
  for (const grp of draft.groups) {
    if (grp.key === node) return { kind: 'group', name: grp.name, within: null, theirs };
    for (const o of grp.options) if (o.key === node) return { kind: 'option', name: o.name, within: grp.name, theirs };
  }
  return { kind: 'draft', name: null, within: null, theirs };
}

const EDITS: Partial<Record<ImportExceptionCode, ExceptionRow['edit']>> = {
  price_missing: 'dish_price', price_unreadable: 'dish_price', price_zero: 'dish_price', option_price_unreadable: 'option_price',
};

function row(draft: ImportDraft, e: ImportException, decisions: ImportDecisions, plan: boolean, existing?: Pick<ExistingMenu, 'groups'>, refused: string | null = null): ExceptionRow {
  const id = exceptionId(e);
  const choices = EXCEPTION_CHOICES[e.code];
  const own = decisions.choices[id];
  const choice = own !== undefined && choices.includes(own) ? own : null;
  const effective = choice ?? (e.severity === 'check' ? choices[0]! : null);
  return { id, e, about: aboutOf(draft, e, existing), choices, choice, effective, open: effective === null, plan, edit: EDITS[e.code] ?? null, refused };
}

/**
 * The owner's answers, with every `fix` still unanswered given its first answer: what the plan would be if the owner
 * took the first answer everywhere. Used only to show the plan (and the plan's own questions) while some are open;
 * applying always sends the owner's own answers.
 */
export function provisional(decisions: ImportDecisions, ids: ReadonlyMap<string, ImportExceptionCode>): ImportDecisions {
  const choices: Record<string, ImportChoice> = { ...decisions.choices };
  for (const [id, code] of ids) if (choices[id] === undefined) choices[id] = EXCEPTION_CHOICES[code][0]!;
  return { ...decisions, choices, pricesConfirmed: true };
}

export type Preview = {
  /** Every exception, the draft's then the plan's, as the list shows them. */
  readonly rows: readonly ExceptionRow[];
  /** The plan as it would run with the owner's answers, the open ones taking their first answer (`provisional`). */
  readonly plan: ImportPlan | null;
  /** Why the plan could not be made even so (too many for the venue's limits, a nesting the venue's groups refuse). */
  readonly planErrors: readonly Issue[];
};

/**
 * The preview: the draft's exceptions, then the plan's own (which need the venue's menu), each with the owner's answer
 * or its default, and the plan that would run. Open `fix` questions (the draft's or the plan's) take their first answer
 * here, so the plan and its questions show before every answer is in. When the plan refuses (an answer it cannot carry
 * out, too many for the venue's limits), its questions still show, from the plan with only the draft's own answers, so
 * the owner can change the answer that stops it; a refusal tied to one question (`opener_qty`) is said at that question.
 */
/** `planApply` itself; a test may count the calls (a large menu takes a while to plan, so the screen plans as little as it can). */
export type Planner = typeof planApply;

export function preview(draft: ImportDraft, existing: ExistingMenu, decisions: ImportDecisions, langs: readonly Lang[], planner: Planner = planApply): Preview {
  const own = draftExceptions(draft, { langs });
  const { plan, errors } = provisionalPlan(draft, existing, decisions, own, langs, planner);
  let questions = plan;
  const refused = new Map<string, string>();
  if (!plan && errors.some((x) => x.code !== 'exception_unresolved')) {
    for (const x of errors) if (x.code === 'opener_qty' && x.message) refused.set(`${x.message}@${x.path}`, x.code);
    const ownIds = new Set(own.map(exceptionId));
    const choices = Object.fromEntries(Object.entries(decisions.choices).filter(([id]) => ownIds.has(id)));
    questions = provisionalPlan(draft, existing, { ...decisions, choices }, own, langs, planner).plan;
  }
  const rows: ExceptionRow[] = own.map((e) => row(draft, e, decisions, false, existing));
  if (questions) for (const e of questions.exceptions.slice(questions.fromDraft)) rows.push(row(draft, e, decisions, true, existing, refused.get(exceptionId(e)) ?? null));
  const said = new Set(rows.filter((r) => r.refused).map((r) => r.id));
  return { rows, plan, planErrors: errors.filter((x) => x.code !== 'exception_unresolved' && !(x.code === 'opener_qty' && said.has(`${x.message}@${x.path}`))) };
}

/**
 * The preview and the gate together, planning as few times as possible: with every answer in, the gate's plan is the
 * preview's (one plan); with only the prices to confirm, the preview plans once more, with them confirmed; otherwise
 * the preview plans as it does on its own. The same result as `preview` and `gate` called one after the other.
 */
export function review(draft: ImportDraft, existing: ExistingMenu, decisions: ImportDecisions, langs: readonly Lang[], planner: Planner = planApply): { readonly pv: Preview; readonly gt: Gate } {
  const gt = gate(draft, existing, decisions, langs, planner);
  if (!gt.ok) return { gt, pv: preview(draft, existing, decisions, langs, planner) };
  const own = draftExceptions(draft, { langs });
  const rows: ExceptionRow[] = own.map((e) => row(draft, e, decisions, false, existing));
  for (const e of gt.plan.exceptions.slice(gt.plan.fromDraft)) rows.push(row(draft, e, decisions, true, existing));
  return { gt, pv: { rows, plan: gt.plan, planErrors: [] } };
}

/** The plan with every open `fix` given its first answer (the draft's and the plan's own), or why there is none. */
function provisionalPlan(draft: ImportDraft, existing: ExistingMenu, decisions: ImportDecisions, own: readonly ImportException[], langs: readonly Lang[], planner: Planner): { plan: ImportPlan | null; errors: readonly Issue[] } {
  const open = new Map<string, ImportExceptionCode>();
  for (const e of own) if (e.severity === 'fix') open.set(exceptionId(e), e.code);
  let errors: readonly Issue[] = [];
  // the plan's own `fix` questions come out as `exception_unresolved` (path = the key, message = the code): give them their
  // first answer too and plan again, until no new one appears (each round adds at least one, so this ends)
  for (let round = 0; round < 8; round++) {
    const r = planner(draft, existing, provisional(decisions, open), { langs });
    if (r.ok) return { plan: r.value, errors: [] };
    const more = r.errors.filter((x) => x.code === 'exception_unresolved' && x.message && !open.has(`${x.message}@${x.path}`));
    errors = r.errors;
    if (!more.length) break;
    for (const x of more) open.set(`${x.message}@${x.path}`, x.message as ImportExceptionCode);
  }
  return { plan: null, errors };
}

export type Gate =
  | { readonly ok: true; readonly plan: ImportPlan }
  | { readonly ok: false; readonly open: number; readonly prices: boolean; readonly errors: readonly Issue[] };

/**
 * May the owner apply now? Only with every `fix` answered (or edited away), the prices confirmed when the draft carries
 * any, and a plan the contracts accept: exactly what `apply_import` checks again (`plan_invalid`).
 */
export function gate(draft: ImportDraft, existing: ExistingMenu, decisions: ImportDecisions, langs: readonly Lang[], planner: Planner = planApply): Gate {
  const r = planner(draft, existing, decisions, { langs });
  if (r.ok) return { ok: true, plan: r.value };
  const open = r.errors.filter((x) => x.code === 'exception_unresolved').length;
  const prices = r.errors.some((x) => x.code === 'prices_unconfirmed');
  return { ok: false, open, prices, errors: r.errors.filter((x) => x.code !== 'exception_unresolved' && x.code !== 'prices_unconfirmed') };
}

// ---------------------------------------------------------------- the owner's answers
export function choose(d: ImportDecisions, id: string, c: ImportChoice | null): ImportDecisions {
  const choices: Record<string, ImportChoice> = { ...d.choices };
  if (c === null) delete choices[id]; else choices[id] = c;
  return { ...d, choices };
}
export const confirmPrices = (d: ImportDecisions, on: boolean): ImportDecisions => ({ ...d, pricesConfirmed: on });

/**
 * Leave a section, a dish, an add-on group or a choice (by its key) out of the import,
 * or put it back (ADR-006 `ImportDecisions.skip`): the plan says it "left out, as you chose", and what is inside it goes
 * with it.
 */
export function leaveOut(d: ImportDecisions, key: string, out: boolean): ImportDecisions {
  const now = new Set(d.skip ?? []);
  if (out) now.add(key); else now.delete(key);
  return { ...d, skip: [...now].sort() };
}
export const leftOut = (d: ImportDecisions): ReadonlySet<string> => new Set(d.skip ?? []);

/**
 * The answers that fit this draft and this screen: a key left out is kept only when it is a section, dish, add-on group
 * or choice the draft has. A key the draft no longer has (it changed meanwhile) is dropped, and so is a dish's own link
 * (`<dish>><group>`): the screen never leaves one out, so one read back from storage would act unseen (SEC-L4).
 */
export function fitAnswers(d: ImportDecisions, draft: ImportDraft): ImportDecisions {
  const keys = new Set<string>();
  for (const s of draft.sections) { keys.add(s.key); for (const x of s.dishes) keys.add(x.key); }
  for (const g of draft.groups) { keys.add(g.key); for (const o of g.options) keys.add(o.key); }
  const skip = (d.skip ?? []).filter((k) => keys.has(k));
  return skip.length === (d.skip ?? []).length ? d : { ...d, skip };
}

/** Did applying do what the preview said (the same counts of every kind and op, and of what was left out and why)? */
export function sameSummary(a: ImportPlan['summary'], b: ImportPlan['summary']): boolean {
  return (Object.keys(a) as PlanKind[]).every((k) => (['create', 'update', 'keep', 'skip'] as const).every((op) => a[k][op] === b[k]?.[op])
    && SKIP_REASONS.every((r) => a[k].skipped[r] === b[k]?.skipped[r]));
}

/**
 * Applying would add no dish to a place that has none (everything left out, or nothing read): the menu step would be
 * marked done with an empty menu, so applying waits and the screen says so (QA L2).
 */
export const addsNoDish = (plan: ImportPlan, existing: Pick<ExistingMenu, 'dishes'>): boolean =>
  existing.dishes.length === 0 && plan.summary.dish.create === 0;

/** Nothing of the import would reach the menu, and nothing of it is there already: everything is left out. */
export const allLeftOut = (plan: ImportPlan): boolean =>
  changesNothing(plan) && (['section', 'dish', 'group', 'option'] as const).every((k) => plan.summary[k].keep === 0);

/** The venue has nothing yet (no section, dish or group): "too many" is then the draft's alone, not "with what you have". */
export const isEmptyMenu = (m: Pick<ExistingMenu, 'sections' | 'dishes' | 'groups'>): boolean => !m.sections.length && !m.dishes.length && !m.groups.length;

/** Does the draft carry a price the owner must see before applying (a dish's, or a paid choice's)? */
export const carriesPrices = (draft: ImportDraft): boolean =>
  draft.sections.some((s) => s.dishes.some((d) => d.price !== null)) || draft.groups.some((g) => g.options.some((o) => o.price !== null && o.price > 0));

// ---------------------------------------------------------------- editing the draft in place
/** A dish's price typed by the owner (agorot; null = "no price for now"): the source's unreadable text goes with it. */
export function withDishPrice(draft: ImportDraft, dishKey: string, price: number | null): ImportDraft {
  if (price !== null && !(Number.isInteger(price) && price >= 0 && price <= LIMITS.price)) return draft;
  return { ...draft, sections: draft.sections.map((s) => (s.dishes.some((d) => d.key === dishKey)
    ? { ...s, dishes: s.dishes.map((d) => (d.key === dishKey ? { ...d, price, priceText: null } : d)) } : s)) };
}
/** A choice's price typed by the owner (agorot, 0 = free). */
export function withOptionPrice(draft: ImportDraft, optionKey: string, price: number): ImportDraft {
  if (!(Number.isInteger(price) && price >= 0 && price <= LIMITS.price)) return draft;
  return { ...draft, groups: draft.groups.map((g) => (g.options.some((o) => o.key === optionKey)
    ? { ...g, options: g.options.map((o) => (o.key === optionKey ? { ...o, price, priceText: null } : o)) } : g)) };
}
/** The draft as the database holds it, and the owner's draft: the same content (jsonb equality, key order aside)? */
export const sameDraft = (a: ImportDraft, b: ImportDraft): boolean => canonical(a) === canonical(b);
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v);
}

// ---------------------------------------------------------------- prices that differ from the venue's
/** A dish or choice the venue already has, read at another price: what the `price_differs` question is about. */
export type PriceDiff = { readonly key: string; readonly name: Text; readonly yours: number; readonly read: number };

/**
 * Behind each `price_differs` question (one per draft section, for its dishes, and one per draft group, for its
 * choices): the dishes and choices the plan matched to the venue's own (`update` or `keep` of an existing row) whose
 * price read differs from the venue's, keyed by the question's key (the section's or the group's).
 */
export function priceDiffs(draft: ImportDraft, existing: ExistingMenu, plan: ImportPlan): Map<string, PriceDiff[]> {
  const out = new Map<string, PriceDiff[]>();
  const add = (k: string, x: PriceDiff) => { const l = out.get(k); if (l) l.push(x); else out.set(k, [x]); };
  const matched = (kind: PlanKind, key: string): string | null => {
    const s = plan.steps.find((x) => x.kind === kind && x.key === key && (x.op === 'update' || x.op === 'keep'));
    return s ? s.id : null;
  };
  for (const s of draft.sections) for (const d of s.dishes) {
    if (d.price === null) continue;
    const id = matched('dish', d.key);
    const row = id ? existing.dishes.find((x) => x.id === id) : null;
    if (row && row.price !== null && row.price !== d.price) add(s.key, { key: d.key, name: d.name, yours: row.price, read: d.price });
  }
  for (const g of draft.groups) for (const o of g.options) {
    if (o.price === null) continue;
    const id = matched('option', o.key);
    const row = id ? existing.options.find((x) => x.id === id) : null;
    if (row && row.price !== o.price) add(g.key, { key: o.key, name: o.name, yours: row.price, read: o.price });
  }
  return out;
}

// ---------------------------------------------------------------- what the reader said, one line per kind
/** One line per kind of note: a reader keeps a note per rule (`noise` has one per kind of line it left out). */
export type NoteLine = { readonly code: string; readonly severity: 'info' | 'check'; readonly count: number; readonly lines: readonly number[] };

/** The reader's notes as the preview says them: by code, in the order they came, counts added, lines merged in order. */
export function noteLines(notes: ReadonlyArray<{ readonly code: string; readonly severity: string; readonly count: number; readonly lines: readonly number[] }>): NoteLine[] {
  const by = new Map<string, { code: string; severity: 'info' | 'check'; count: number; lines: Set<number> }>();
  for (const n of notes) {
    let x = by.get(n.code);
    if (!x) by.set(n.code, (x = { code: n.code, severity: n.severity === 'check' ? 'check' : 'info', count: 0, lines: new Set() }));
    x.count += n.count;
    for (const l of n.lines) x.lines.add(l);
  }
  return [...by.values()].map((x) => ({ code: x.code, severity: x.severity, count: x.count, lines: [...x.lines].sort((a, b) => a - b) }));
}

// ---------------------------------------------------------------- the plan in words
export type PlanCount = { readonly kind: PlanKind; readonly op: PlanOp; readonly n: number; readonly reason: SkipReason | null };

/**
 * The plan's summary as the lines the preview says: what is added, updated, already there, and left out, each left-out
 * line with its reason (the owner's answer, nothing in it, with what it belongs to, nothing uses it); zeros dropped. The
 * links (dish_group) are not said: a dish's add-ons show under the dish.
 */
export function planLines(plan: ImportPlan): PlanCount[] {
  const out: PlanCount[] = [];
  for (const op of ['create', 'update', 'keep', 'skip'] as const) {
    for (const kind of ['section', 'dish', 'group', 'option', 'photo'] as const) {
      const s = plan.summary[kind];
      if (op !== 'skip') { if (s[op] > 0) out.push({ kind, op, n: s[op], reason: null }); continue; }
      for (const reason of SKIP_REASONS) if (s.skipped[reason] > 0) out.push({ kind, op, n: s.skipped[reason], reason });
    }
  }
  return out;
}
/** Applying would change nothing on the menu (the same menu imported again: Hopa test 1). */
export const changesNothing = (plan: ImportPlan): boolean =>
  (['section', 'dish', 'group', 'option', 'dish_group', 'photo'] as const).every((k) => plan.summary[k].create === 0 && plan.summary[k].update === 0);

export { draftCounts };
