/**
 * One draft from what one or more readings produced (a paste, several screenshots, several pastes of the same page):
 * the step every reader ends with, and `mergeDrafts`.
 *
 * - **Same node.** Two sections are the same when their names have the same `importKey` in the language the source
 *   printed (Hebrew first; a translated name never decides). Two dishes are the same when they are in the same section
 *   and have the same name, and their prices agree (one price, or none); a dish read with two different prices stays
 *   two dishes, and the draft's `dish_duplicate` exception lets the owner choose. Two option groups are the same when
 *   everything about them is: names, choice, limits, and each option's name, price, quantity, default and nested group.
 *   Groups one dish shows under one name become one (`combine`).
 * - **Values** are joined, never taken from the first copy: of the values the copies give, the printed one beats a
 *   translated one, then the longest (a description cut short gives way to the full one), then the first in code-unit
 *   order; a section's kind is its most specific; tags are joined. Values that cannot both be true are left for the
 *   owner instead: limits that differ are left unstated (`limits_guessed`), an option read at two prices has none
 *   (`option_price_unreadable`, the prices kept as its text), an option pre-selected in one copy only is not. So the
 *   result does not depend on the order of the inputs, and merging it again with any of them changes nothing.
 * - **Order.** One order that each input's own order agrees with (`mergeOrder`).
 * - **Keys** come from what a node is (`KeyMaker`), so reading the same text again gives the same keys.
 * - **Bounds.** Texts are made storable and cut to what the draft allows, limits a group cannot have are dropped, a
 *   dish's groups of the same name become one, and past `DRAFT_CAPS`, `DRAFT_BYTES_MAX` or `EXCEPTIONS_MAX` the last
 *   dishes are left out, each with a note: every draft built here passes `validateDraft`.
 */
import {
  DRAFT_BYTES_MAX, DRAFT_CAPS, draftBytes, draftExceptions, draftGroupLimits, DROPPED_MAX, EXCEPTIONS_MAX, fallbackKey, GROUP_UNITS_MAX, importKey, isBlank, isInt,
  DRAFT_TEXT_MAX, LANGS, LIMITS, ROOMS, SECTION_KINDS, STOCK_RE, stripBlank, TAGS,
  type DraftDish, type DraftDishGroup, type DraftGroup, type DraftOption, type DraftPhoto, type DraftSection, type ImportDraft, type ImportSource,
  type Lang, type LayoutGuessRule, type Room, type SectionKind, type Text,
} from '@mana/contracts';
import { KeyMaker } from './keys.ts';
import { newDish, newGroup, newOption, newSection, type MDish, type MenuModel, type MGroup, type MLink, type MOption, type MSection } from './model.ts';
import { NoteBook, type PendingNote, type ReaderNote } from './notes.ts';
import { mergeOrder, type Rank } from './order.ts';
import { clip, storable } from './text.ts';

/** What a reader returns: the draft (with `dropped`, the lines it could not read) and the notes on the source. */
export type ReadResult = { readonly draft: ImportDraft; readonly notes: readonly ReaderNote[] };
/** One reading, before the draft: a reader's model, its whole-input notes and its unread line count. */
export type Reading = { readonly model: MenuModel; readonly notes: readonly ReaderNote[]; readonly dropped: number };

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * What decides that two names are the same node: the `importKey` of the first language the source printed (not
 * translated) that has one; else of any language; else the name's own text (a name made only of signs or emoji).
 */
export function nameIdentity(name: Text, translated: readonly Lang[]): string {
  for (const pass of [false, true]) {
    for (const l of LANGS) {
      if (!pass && translated.includes(l)) continue;
      const k = importKey(name[l]);
      if (k !== '') return `${l}:${k}`;
    }
  }
  for (const l of LANGS) { const s = stripBlank(name[l]); if (s !== '') return `${l}=${s}`; }
  return '';
}

// ---------------------------------------------------------------- choosing a value among copies

type Cand = { readonly value: string; readonly translated: boolean };

const points = (s: string): number => { let n = 0; for (const _ of s) n++; return n; };
/** The order values are joined by: printed before translated, then longer (a description cut short gives way to the
 * full one), then the first in code-unit order. A total order, so the pick is a join: the same whatever the order of
 * the copies, how many there are, or whether one of them is already a merge. */
const better = (a: Cand & { n: number }, b: Cand & { n: number }): boolean =>
  a.translated !== b.translated ? !a.translated : a.n !== b.n ? a.n > b.n : cmp(a.value, b.value) < 0;

function pick(cands: readonly Cand[]): Cand {
  let best: (Cand & { n: number }) | null = null;
  for (const c of cands) {
    const value = stripBlank(c.value);
    if (value === '') continue;
    const x = { value, translated: c.translated, n: points(value) };
    if (best === null || better(x, best)) best = x;
  }
  return best === null ? { value: '', translated: false } : { value: best.value, translated: best.translated };
}

/** A bilingual text picked language by language, and the languages whose pick was a translation. */
function pickText(items: ReadonlyArray<{ text: Text; translated: readonly Lang[] }>): { text: Text; translated: Lang[] } {
  const he = pick(items.map((i) => ({ value: i.text.he, translated: i.translated.includes('he') })));
  const en = pick(items.map((i) => ({ value: i.text.en, translated: i.translated.includes('en') })));
  return { text: { he: he.value, en: en.value }, translated: LANGS.filter((l) => (l === 'he' ? he : en).translated && (l === 'he' ? he : en).value !== '') };
}

const printedText = (texts: readonly Text[]): Text => pickText(texts.map((text) => ({ text, translated: [] }))).text;

/** A section's kind among its copies: the most specific (food, the default, last): a join, as `pick`. */
const joinKind = (kinds: readonly SectionKind[]): SectionKind => kinds.reduce<SectionKind>((a, k) => (SECTION_KINDS.indexOf(k) > SECTION_KINDS.indexOf(a) ? k : a), 'food');
/** The first in a fixed order (`order`, then code units), among the values given; null when none. */
const joinFirst = <T extends string>(values: readonly T[], order: readonly T[] = []): T | null =>
  values.reduce<T | null>((a, v) => (a === null || order.indexOf(v) < order.indexOf(a) || (order.indexOf(v) === order.indexOf(a) && cmp(v, a) < 0) ? v : a), null);

/** The value all copies give, else null (two copies that differ, or one that states it and one that does not). */
const allSame = <T>(values: readonly T[]): T | null => (values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null);

// ---------------------------------------------------------------- normalising one reading (a copy; inputs are left as they are)

function within(lim: { min: number | null; max: number | null }, selection: 'single' | 'multiple'): boolean {
  const { min, max } = lim;
  const lo = min === null || (isInt(min) && min >= 0 && min <= GROUP_UNITS_MAX);
  const hi = max === null || (isInt(max) && max >= 1 && max <= GROUP_UNITS_MAX);
  if (!lo || !hi || (min !== null && max !== null && min > max)) return false;
  return selection === 'multiple' || ((min ?? 0) <= 1 && (max === null || max === 1));
}

/** The options as `draftGroupLimits` reads them. */
const limitOptions = (g: MGroup) => g.options.map((o) => ({ price: o.price, maxQty: o.maxQty, default: o.isDefault }));

/** A group's limits it cannot have are left unstated, and pre-selected options past its maximum are cleared. */
function settle(g: MGroup): void {
  if (!within(g, g.selection)) {
    g.min = null;
    g.max = null;
    g.notes.push({ code: 'limits_dropped', lines: [] });
  }
  if (g.options.filter((o) => o.isDefault).length > draftGroupLimits(g, limitOptions(g)).max) {
    for (const o of g.options) o.isDefault = false;
    g.notes.push({ code: 'defaults_cleared', lines: [] });
  }
}

/**
 * The classes of groups one dish may not carry side by side (the contracts' `addon_duplicate`, by `nameScore`): the
 * same choice and the same Hebrew key, or the same English key where the Hebrew ones do not differ; a name of symbols
 * only by its exact text (`fallbackKey`). Joined transitively; linear: each key points at the groups it names.
 */
function sameNameClasses(groups: readonly MGroup[]): number[][] {
  const parent = groups.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const join = (i: number, j: number): void => { const a = find(i), b = find(j); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  const heOf = groups.map((g) => {
    const he = importKey(g.name.he);
    return he !== '' || importKey(g.name.en) !== '' || (isBlank(g.name.he) && isBlank(g.name.en)) ? he : fallbackKey(g.name);
  });
  const byHe = new Map<string, number>();
  const byEn = new Map<string, number[]>();
  groups.forEach((g, i) => {
    const he = heOf[i]!, en = importKey(g.name.en);
    if (he !== '') {
      const id = `${g.selection}|${he}`;
      const j = byHe.get(id);
      if (j === undefined) byHe.set(id, i); else join(i, j);
    }
    if (en !== '') {
      const id = `${g.selection}|${en}`;
      let seen = byEn.get(id);
      if (!seen) byEn.set(id, (seen = []));
      // an English match counts only where the Hebrew names do not differ (one Hebrew name per entry is enough)
      const j = seen.find((x) => heOf[x] === '' || he === '' || heOf[x] === he);
      if (j !== undefined) join(i, j);
      if (!seen.some((x) => heOf[x] === he)) seen.push(i);
    }
  });
  const classes = new Map<number, number[]>();
  groups.forEach((_, i) => { const r = find(i); const c = classes.get(r); if (c) c.push(i); else classes.set(r, [i]); });
  return [...classes.values()];
}

/** Prices a merge could not choose between, written so a later merge reads them back: "+₪4.00 / +₪5.00", "+₪4.00…+₪9.00". */
const money = (a: number): string => `+₪${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
const PRICES_LIST = /^\+₪\d{1,6}\.\d{2}(?: \/ \+₪\d{1,6}\.\d{2}){1,2}$/u;
const PRICES_SPAN = /^\+₪(\d{1,6}\.\d{2})…\+₪(\d{1,6}\.\d{2})$/u;
const centsOf = (s: string): number => Math.round(Number(s) * 100);

/**
 * An option's price among its copies. One price: that price. Prices that differ: none, and all of them as the price
 * text (the draft's `option_price_unreadable` asks the owner): never the first copy's. A price beats a text the reader
 * could not read; texts alone: `pick`. A join: the result read again with any of the copies gives the same.
 */
function joinPrices(copies: readonly MOption[]): { price: number | null; priceText: string | null } {
  const values = new Set<number>();
  let lo = Infinity, hi = -Infinity;
  const texts: string[] = [];
  for (const o of copies) {
    if (o.price !== null) { values.add(o.price); continue; }
    if (o.priceText === null) continue;
    const span = PRICES_SPAN.exec(o.priceText);
    if (span) { lo = Math.min(lo, centsOf(span[1]!)); hi = Math.max(hi, centsOf(span[2]!)); }
    else if (PRICES_LIST.test(o.priceText)) for (const p of o.priceText.split(' / ')) values.add(centsOf(p.slice(2)));
    else texts.push(o.priceText);
  }
  if (lo <= hi) {
    for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return { price: null, priceText: `${money(lo)}…${money(hi)}` };
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return { price: sorted[0]!, priceText: null };
  if (sorted.length > 3) return { price: null, priceText: `${money(sorted[0]!)}…${money(sorted[sorted.length - 1]!)}` };
  if (sorted.length > 1) return { price: null, priceText: sorted.map(money).join(' / ') };
  return { price: null, priceText: texts.length ? pick(texts.map((value) => ({ value, translated: false }))).value : null };
}

/**
 * One option from its copies (screenshots that each show the group): names and price joined, the largest quantity,
 * the nested group with the smallest signature, and pre-selected only when every copy shows it so (`defaultsDiffer`
 * when they disagree: never the first copy's word).
 */
function joinOption(copies: readonly MOption[], sig: (g: MGroup) => string): { option: MOption; defaultsDiffer: boolean } {
  const v = pickText(copies.map((o) => ({ text: o.name, translated: o.translated })));
  const price = joinPrices(copies);
  const isDefault = allSame(copies.map((o) => o.isDefault));
  let opens: MGroup | null = null;
  for (const o of copies) if (o.opens && (opens === null || cmp(sig(o.opens), sig(opens)) < 0)) opens = o.opens;
  const maxQty = opens ? 1 : Math.max(...copies.map((o) => o.maxQty));
  return { option: newOption(v.text, price.price, { translated: v.translated, priceText: price.priceText, maxQty, isDefault: isDefault === true, opens }), defaultsDiffer: isDefault === null };
}

/**
 * One group from the groups a dish shows under one name (screenshots that each show part of its options): the options
 * of all, in the order they agree with, each joined (`joinOption`); a limit is kept only when every copy states the
 * same one, and copies that disagree on what is pre-selected leave the limits unstated (`limits_guessed` asks the
 * owner). A join: combining the result again with any of the copies gives the same group.
 */
function combine(members: readonly MGroup[], sig: (g: MGroup) => string): MGroup {
  const v = pickText(members.map((g) => ({ text: g.name, translated: g.translated })));
  const seqs = members.map((g) => g.options.map((o) => nameIdentity(o.name, o.translated)));
  const rank = new Map<string, Rank>();
  const copies = new Map<string, MOption[]>();
  members.forEach((g, i) => g.options.forEach((o, j) => {
    const id = seqs[i]![j]!;
    if (!rank.has(id)) { rank.set(id, [i, j]); copies.set(id, []); }
    copies.get(id)!.push(o);
  }));
  const notes: PendingNote[] = members.flatMap((g) => g.notes);
  const min = allSame(members.map((g) => g.min)), max = allSame(members.map((g) => g.max));
  if ((min === null && members.some((g) => g.min !== null)) || (max === null && members.some((g) => g.max !== null))) notes.push({ code: 'limits_dropped', lines: [] });
  let defaultsDiffer = false;
  const options = mergeOrder(seqs, rank).map((id) => {
    const r = joinOption(copies.get(id)!, sig);
    defaultsDiffer ||= r.defaultsDiffer;
    return r.option;
  });
  const g = newGroup(v.text, { translated: v.translated, selection: members[0]!.selection, min, max, options, notes });
  if (defaultsDiffer) { g.min = null; g.max = null; notes.push({ code: 'defaults_cleared', lines: [] }); }
  settle(g);
  return g;
}

function clipText(t: Text, max: number, notes: PendingNote[], line: number | null): Text {
  const he = clip(stripBlank(storable(t.he)), max), en = clip(stripBlank(storable(t.en)), max);
  if (he.clipped || en.clipped) notes.push({ code: 'text_clipped', lines: line === null ? [] : [line] });
  return { he: he.text, en: en.text };
}

const translatedOf = (tr: readonly Lang[], ...texts: Text[]): Lang[] => LANGS.filter((l) => tr.includes(l) && texts.some((t) => !isBlank(t[l])));
const named = (t: Text): boolean => !isBlank(t.he) || !isBlank(t.en);

/**
 * How much of one reading is looked at, past which the rest is left out before any merging (with a `caps_reached`
 * note): several times what a draft holds (`DRAFT_CAPS`), so repeats that merge away still fit, and never so much
 * that ordering and merging take long.
 */
const READ_BOUND = { sections: 4 * DRAFT_CAPS.sections, dishes: 8 * DRAFT_CAPS.dishes, groupsPerDish: 4 * DRAFT_CAPS.groupsPerDish, optionsPerGroup: 4 * DRAFT_CAPS.optionsPerGroup } as const;
/** What was left out past `READ_BOUND`, by the note's rule (a machine word, as the contracts' notes want). */
type Left = { sections: number; dishes: number; groups_per_dish: number; options_per_group: number };

function normalise(model: MenuModel, left: Left): MenuModel {
  const groups = new Map<MGroup, MGroup | null>();
  const group = (g: MGroup): MGroup | null => {
    if (groups.has(g)) return groups.get(g)!;
    const notes: PendingNote[] = [...g.notes];
    const name = clipText(g.name, DRAFT_TEXT_MAX.group, notes, null);
    if (!named(name)) { groups.set(g, null); return null; }
    const copy = newGroup(name, { translated: translatedOf(g.translated, name), selection: g.selection, notes });
    groups.set(g, copy);
    copy.min = g.min;
    copy.max = g.max;
    left.options_per_group += Math.max(0, g.options.length - READ_BOUND.optionsPerGroup);
    for (const o of g.options.slice(0, READ_BOUND.optionsPerGroup)) {
      const oname = clipText(o.name, DRAFT_TEXT_MAX.option, notes, null);
      if (!named(oname)) continue;
      const opens = o.opens ? group(o.opens) : null;
      const price = isInt(o.price) && o.price >= 0 && o.price <= LIMITS.price ? o.price : null;
      const text = price === null && o.priceText !== null && !isBlank(o.priceText) ? clip(stripBlank(storable(o.priceText)), DRAFT_TEXT_MAX.priceText).text : null;
      copy.options.push(newOption(oname, price, {
        translated: translatedOf(o.translated, oname), priceText: text,
        maxQty: opens ? 1 : Math.min(Math.max(isInt(o.maxQty) ? o.maxQty : 1, 1), LIMITS.optionQuantity), isDefault: o.isDefault === true, opens,
      }));
    }
    if (copy.options.length === 0) { groups.set(g, null); return null; }
    settle(copy);
    return copy;
  };

  const sections: MSection[] = [];
  let dishBudget: number = READ_BOUND.dishes;
  left.sections += Math.max(0, model.sections.length - READ_BOUND.sections);
  for (const s of model.sections.slice(0, READ_BOUND.sections)) {
    const notes: PendingNote[] = [...s.notes];
    const name = clipText(s.name, DRAFT_TEXT_MAX.section, notes, s.line);
    if (!named(name)) continue;
    const copy = newSection(name, (SECTION_KINDS as readonly string[]).includes(s.kind) ? s.kind : 'food', {
      translated: translatedOf(s.translated, name), room: s.room !== null && (ROOMS as readonly string[]).includes(s.room) ? s.room : null, notes, line: s.line,
    });
    left.dishes += Math.max(0, s.dishes.length - dishBudget);
    const dishes = s.dishes.slice(0, Math.max(0, dishBudget));
    dishBudget -= dishes.length;
    for (const d of dishes) {
      const dn: PendingNote[] = [...d.notes];
      const dname = clipText(d.name, DRAFT_TEXT_MAX.dish, dn, d.line);
      if (!named(dname)) continue;
      const desc = clipText(d.desc, DRAFT_TEXT_MAX.desc, dn, d.line);
      const price = isInt(d.price) && d.price >= 0 && d.price <= LIMITS.price ? d.price : null;
      const links: MLink[] = [];
      left.groups_per_dish += Math.max(0, d.links.length - READ_BOUND.groupsPerDish);
      for (const a of d.links.slice(0, READ_BOUND.groupsPerDish)) {
        const g = group(a.group);
        if (g && !links.some((l) => l.group === g)) links.push({ group: g, min: a.min, max: a.max });
      }
      copy.dishes.push(newDish(dname, {
        desc, translated: translatedOf(d.translated, dname, desc), price,
        priceText: price === null && d.priceText !== null && !isBlank(d.priceText) ? clip(stripBlank(storable(d.priceText)), DRAFT_TEXT_MAX.priceText).text : null,
        priceNote: clipText(d.priceNote, DRAFT_TEXT_MAX.priceNote, dn, d.line), tags: TAGS.filter((t) => d.tags.includes(t)),
        allergens: clipText(d.allergens, DRAFT_TEXT_MAX.allergens, dn, d.line), photo: d.photo,
        illustration: d.illustration !== null && STOCK_RE.test(d.illustration) ? d.illustration : null, links, notes: dn, line: d.line,
      }));
    }
    sections.push(copy);
  }
  // a nested group left with no option (all its names blank) opens nothing
  for (const g of groups.values()) for (const o of g?.options ?? []) if (o.opens && o.opens.options.length === 0) o.opens = null;
  return { sections };
}

// ---------------------------------------------------------------- the build

/** Everything about a group that makes it the same group (nested groups to three levels, enough past the limit of one). */
function signature(g: MGroup, depth = 0): string {
  return JSON.stringify([
    nameIdentity(g.name, g.translated), g.selection, g.min, g.max,
    g.options.map((o) => [nameIdentity(o.name, o.translated), o.price, o.price === null ? o.priceText : null, o.maxQty, o.isDefault,
      o.opens === null ? null : depth < 3 ? signature(o.opens, depth + 1) : '…']),
  ]);
}

type SectionOcc = { readonly s: MSection; readonly rank: Rank };
type DishOcc = { readonly d: MDish; readonly rank: Rank };

/**
 * Builds the draft of `source` from one or more readings of the same menu. When the draft would be larger than
 * `DRAFT_BYTES_MAX` or carry more than `EXCEPTIONS_MAX` exceptions (which `validateDraft` refuses), its last dishes
 * are left out until it fits, with a `caps_reached` note.
 */
export function buildDraft(source: ImportSource, readings: readonly Reading[]): ReadResult {
  const left: Left = { sections: 0, dishes: 0, groups_per_dish: 0, options_per_group: 0 };
  const models = readings.map((r) => normalise(r.model, left));
  let cap: number = DRAFT_CAPS.dishes, rule = 'dishes';
  for (let pass = 0; ; pass++) {
    const r = build(source, readings, models, left, cap, rule);
    const dishes = r.draft.sections.flatMap((s) => s.dishes);
    const bytes = draftBytes(r.draft), exceptions = draftExceptions(r.draft).length;
    if ((bytes <= DRAFT_BYTES_MAX && exceptions <= EXCEPTIONS_MAX) || dishes.length === 0 || pass === 8) return r;
    let keep = dishes.length;
    if (bytes > DRAFT_BYTES_MAX) {
      rule = 'bytes';
      for (let excess = bytes - DRAFT_BYTES_MAX; keep > 0 && excess > 0;) excess -= draftBytes(dishes[--keep]) + 2;
    }
    if (exceptions > EXCEPTIONS_MAX) {
      if (rule !== 'bytes') rule = 'exceptions';
      keep = Math.min(keep, Math.floor((dishes.length * EXCEPTIONS_MAX) / exceptions));
    }
    cap = Math.max(0, Math.min(keep, cap - 1));
  }
}

function build(source: ImportSource, readings: readonly Reading[], models: readonly MenuModel[], left: Left, dishCap: number, capRule: string): ReadResult {
  const book = new NoteBook();
  let dropped = 0;
  for (const r of readings) {
    dropped += r.dropped;
    for (const n of r.notes) book.add(n.code, n.lines, { key: n.key, rule: n.rule, count: n.count });
  }
  for (const [rule, count] of Object.entries(left)) if (count > 0) book.add('caps_reached', [], { rule, count });

  // ---- sections: the same name is the same section
  const sectionOccs = new Map<string, SectionOcc[]>();
  const sectionRank = new Map<string, Rank>();
  const sectionSeqs = models.map((m, i) => m.sections.map((s, j) => {
    const id = nameIdentity(s.name, s.translated);
    if (!sectionOccs.has(id)) { sectionOccs.set(id, []); sectionRank.set(id, [i, j]); }
    sectionOccs.get(id)!.push({ s, rank: [i, j] });
    return id;
  }));
  const sectionOrder = mergeOrder(sectionSeqs, sectionRank);

  // ---- dishes of each section: the same name with agreeing prices is the same dish
  type Merged = { id: string; occs: DishOcc[] };
  const plan: Array<{ id: string; occs: SectionOcc[]; dishes: Merged[] }> = [];
  for (const sid of sectionOrder) {
    const occs = sectionOccs.get(sid)!;
    const byDish = new Map<string, DishOcc[]>();
    const dishRank = new Map<string, Rank>();
    const seqs = occs.map((o) => o.s.dishes.map((d, k) => {
      const id = nameIdentity(d.name, d.translated);
      const rank = [...o.rank, k];
      if (!byDish.has(id)) { byDish.set(id, []); dishRank.set(id, rank); }
      byDish.get(id)!.push({ d, rank });
      return id;
    }));
    const dishes: Merged[] = [];
    for (const did of mergeOrder(seqs, dishRank)) {
      const all = byDish.get(did)!;
      const prices = [...new Set(all.filter((o) => o.d.price !== null).map((o) => o.d.price!))].sort((a, b) => a - b);
      const parts: Merged[] = prices.length <= 1
        ? [{ id: `${sid}/${did}`, occs: all }]
        : [...prices.map((p) => ({ id: `${sid}/${did}#${p}`, occs: all.filter((o) => o.d.price === p) })),
          ...(all.some((o) => o.d.price === null) ? [{ id: `${sid}/${did}#none`, occs: all.filter((o) => o.d.price === null) }] : [])];
      // the copies of one name at different prices, by price (never by which input came first)
      dishes.push(...parts);
    }
    plan.push({ id: sid, occs, dishes });
  }

  // ---- bounds on sections and dishes
  const keptSections = plan.filter((p) => p.dishes.length > 0);
  for (const p of plan) if (p.dishes.length === 0) book.add('section_empty', p.occs.map((o) => o.s.line).filter((l): l is number => l !== null), { count: 1 });
  if (keptSections.length > DRAFT_CAPS.sections) book.add('caps_reached', [], { rule: 'sections', count: keptSections.length - DRAFT_CAPS.sections });
  const sections = keptSections.slice(0, DRAFT_CAPS.sections);
  let dishBudget = dishCap, dishesLeft = 0;
  for (const p of sections) {
    const keep = Math.min(p.dishes.length, dishBudget);
    dishesLeft += p.dishes.length - keep;
    p.dishes = p.dishes.slice(0, keep);
    dishBudget -= keep;
  }
  if (dishesLeft > 0) book.add('caps_reached', [], { rule: capRule, count: dishesLeft });
  const live = sections.filter((p) => p.dishes.length > 0);

  // ---- each dish's groups (merged in order), and every group reached from them
  const sigOf = new Map<MGroup, string>();
  const sig = (g: MGroup): string => { let s = sigOf.get(g); if (s === undefined) sigOf.set(g, (s = signature(g))); return s; };
  const groupOccs = new Map<string, { list: MGroup[]; seen: Set<MGroup> }>();
  const groupOrder: string[] = [];
  const visit = (g: MGroup, path: Set<MGroup>): void => {
    if (path.has(g)) return;
    const s = sig(g);
    let occ = groupOccs.get(s);
    if (!occ) { groupOccs.set(s, (occ = { list: [], seen: new Set() })); groupOrder.push(s); }
    if (occ.seen.has(g)) return;
    occ.seen.add(g);
    occ.list.push(g);
    const inner = new Set(path).add(g);
    for (const o of g.options) if (o.opens) visit(o.opens, inner);
  };
  type DishLinks = Array<{ sig: string; min: number | null; max: number | null }>;
  const linksOf = new Map<string, DishLinks>();
  let linksLeft = 0;
  for (const p of live) for (const m of p.dishes) {
    const seqs = m.occs.map((o) => o.d.links.map((a) => sig(a.group)));
    const rank = new Map<string, Rank>();
    const bySig = new Map<string, MLink[]>();
    m.occs.forEach((o) => o.d.links.forEach((a, k) => {
      const s = sig(a.group);
      if (!rank.has(s)) { rank.set(s, [...o.rank, k]); bySig.set(s, []); }
      bySig.get(s)!.push(a);
    }));
    const ordered = mergeOrder(seqs, rank).map((s) => ({ group: bySig.get(s)![0]!.group, all: bySig.get(s)!, combined: false }));
    // a dish never carries two groups of the same name and choice: each class becomes one, where its first one was
    const kept = sameNameClasses(ordered.map((k) => k.group)).map((c) => (c.length === 1 ? ordered[c[0]!]! : {
      group: combine(c.map((i) => ordered[i]!.group), sig), all: c.flatMap((i) => ordered[i]!.all), combined: true,
    }));
    linksLeft += Math.max(0, kept.length - DRAFT_CAPS.groupsPerDish);
    const links: DishLinks = kept.slice(0, DRAFT_CAPS.groupsPerDish).map((k) => {
      for (const g of k.combined ? [k.group] : k.all.map((a) => a.group)) visit(g, new Set());
      return { sig: sig(k.group), min: allSame(k.all.map((a) => a.min)), max: allSame(k.all.map((a) => a.max)) };
    });
    linksOf.set(m.id, links);
  }
  if (linksLeft > 0) book.add('caps_reached', [], { rule: 'groups_per_dish', count: linksLeft });
  let groupsKept = new Set(groupOrder.slice(0, DRAFT_CAPS.groups));
  if (groupOrder.length > DRAFT_CAPS.groups) book.add('caps_reached', [], { rule: 'groups', count: groupOrder.length - DRAFT_CAPS.groups });
  // a group is kept only when a kept dish, or a kept option of a kept group, still reaches it
  for (;;) {
    const reached = new Set<string>();
    const reach = (s: string): void => {
      if (!groupsKept.has(s) || reached.has(s)) return;
      reached.add(s);
      for (const o of groupOccs.get(s)!.list[0]!.options.slice(0, DRAFT_CAPS.optionsPerGroup)) if (o.opens) reach(sig(o.opens));
    };
    for (const links of linksOf.values()) for (const l of links) reach(l.sig);
    if (reached.size === groupsKept.size) break;
    groupsKept = reached;
  }

  // ---- keys, in draft order: sections, dishes, groups, options
  const keys = new KeyMaker();
  const sectionKey = new Map<string, string>();
  const dishKey = new Map<string, string>();
  const groupKey = new Map<string, string>();
  const sectionValues = new Map<string, ReturnType<typeof pickText>>();
  const dishValues = new Map<string, { name: ReturnType<typeof pickText>; desc: ReturnType<typeof pickText> }>();
  for (const p of live) {
    const v = pickText(p.occs.map((o) => ({ text: o.s.name, translated: o.s.translated })));
    sectionValues.set(p.id, v);
    sectionKey.set(p.id, keys.make('s', v.text.en, p.id));
  }
  for (const p of live) for (const m of p.dishes) {
    const name = pickText(m.occs.map((o) => ({ text: o.d.name, translated: o.d.translated })));
    const desc = pickText(m.occs.map((o) => ({ text: o.d.desc, translated: o.d.translated })));
    dishValues.set(m.id, { name, desc });
    dishKey.set(m.id, keys.make('d', name.text.en, m.id));
  }
  const keptOrder = groupOrder.filter((s) => groupsKept.has(s));
  const groupName = new Map<string, ReturnType<typeof pickText>>();
  for (const s of keptOrder) {
    const v = pickText(groupOccs.get(s)!.list.map((g) => ({ text: g.name, translated: g.translated })));
    groupName.set(s, v);
    groupKey.set(s, keys.make('g', v.text.en, s));
  }

  // ---- the draft's nodes
  const notesOn = (key: string, notes: readonly PendingNote[]): void => { for (const n of notes) book.add(n.code, n.lines, { key, count: 1, rule: n.rule ?? null }); };
  const groups: DraftGroup[] = [];
  let optionsLeft = 0;
  for (const s of keptOrder) {
    const occs = groupOccs.get(s)!.list;
    const first = occs[0]!;
    const key = groupKey.get(s)!;
    const name = groupName.get(s)!;
    optionsLeft += Math.max(0, first.options.length - DRAFT_CAPS.optionsPerGroup);
    const options: DraftOption[] = first.options.slice(0, DRAFT_CAPS.optionsPerGroup).map((o, j) => {
      const v = pickText(occs.map((g) => ({ text: g.options[j]!.name, translated: g.options[j]!.translated })));
      const opened = o.opens ? sig(o.opens) : null;
      return {
        key: keys.make('o', v.text.en, `${s}/${nameIdentity(o.name, o.translated)}`), name: v.text, translated: v.translated, price: o.price, priceText: o.price === null ? o.priceText : null,
        maxQty: o.maxQty, default: o.isDefault, opens: opened !== null && groupsKept.has(opened) ? groupKey.get(opened)! : null,
      };
    });
    groups.push({ key, name: name.text, translated: name.translated, selection: first.selection, min: first.min, max: first.max, options });
    notesOn(key, dedupeNotes(occs.flatMap((g) => g.notes)));
  }
  if (optionsLeft > 0) book.add('caps_reached', [], { rule: 'options_per_group', count: optionsLeft });
  const groupByKey = new Map(groups.map((g) => [g.key, g] as const));

  const draftSections: DraftSection[] = live.map((p) => {
    const sv = sectionValues.get(p.id)!;
    const key = sectionKey.get(p.id)!;
    notesOn(key, dedupeNotes(p.occs.flatMap((o) => o.s.notes)));
    const dishes: DraftDish[] = p.dishes.map((m) => {
      const ds = m.occs.map((o) => o.d);
      const { name, desc } = dishValues.get(m.id)!;
      const k = dishKey.get(m.id)!;
      notesOn(k, dedupeNotes(ds.flatMap((d) => d.notes)));
      const price = ds.find((d) => d.price !== null)?.price ?? null;
      const shown = ds.map((d) => d.priceText).filter((t): t is string => t !== null);
      const links: DraftDishGroup[] = linksOf.get(m.id)!.filter((l) => groupsKept.has(l.sig)).map((l) => {
        const group = groupKey.get(l.sig)!;
        return { group, ...tightening(groupByKey.get(group)!, l.min, l.max) };
      });
      return {
        key: k, name: name.text, desc: desc.text, translated: LANGS.filter((l) => name.translated.includes(l) || desc.translated.includes(l)),
        price, priceText: price === null && shown.length ? pick(shown.map((value) => ({ value, translated: false }))).value : null,
        priceNote: printedText(ds.map((d) => d.priceNote)), tags: TAGS.filter((t) => ds.some((d) => d.tags.includes(t))),
        allergens: printedText(ds.map((d) => d.allergens)), photo: photoOf(ds), illustration: joinFirst(ds.map((d) => d.illustration).filter((x): x is string => x !== null)),
        groups: links,
      };
    });
    const kind: SectionKind = joinKind(p.occs.map((o) => o.s.kind));
    const room: Room | null = joinFirst(p.occs.map((o) => o.s.room).filter((r): r is Room => r !== null), ROOMS);
    return { key, name: sv.text, translated: sv.translated, kind, room, dishes };
  });

  return { draft: { v: 1, source, sections: draftSections, groups, dropped: Math.min(dropped, DROPPED_MAX) }, notes: book.list() };
}

/**
 * A dish's own limits on a group, kept only when the contracts allow them (else the group's own: null): within 0–30,
 * the minimum within the maximum, and only tightening, never contradicting, the group's stated limits. (What the
 * group's options can reach is the draft's `limits_unreachable`, not the reader's to drop.)
 */
function tightening(g: DraftGroup, min: number | null, max: number | null): { min: number | null; max: number | null } {
  if (min === null && max === null) return { min, max };
  const own = draftGroupLimits(g, g.options);
  const loosens = own.stated && ((min !== null && g.min !== null && min < g.min) || (max !== null && g.max !== null && max > g.max));
  const contradicts = (min !== null && g.max !== null && min > g.max) || (max !== null && g.min !== null && max < g.min);
  return within({ min, max }, g.selection) && !loosens && !contradicts ? { min, max } : { min: null, max: null };
}

function photoOf(dishes: readonly MDish[]): DraftPhoto | null {
  const photos = dishes.map((d) => d.photo).filter((p): p is DraftPhoto => p !== null).sort((a, b) => cmp(a.path, b.path));
  if (photos.length === 0) return null;
  const path = photos[0]!.path;
  return { path, rights: photos.filter((p) => p.path === path).every((p) => p.rights === 'confirmed') ? 'confirmed' : 'unknown' };
}

function dedupeNotes(notes: readonly PendingNote[]): PendingNote[] {
  const by = new Map<string, { code: PendingNote['code']; rule?: LayoutGuessRule; lines: number[] }>();
  for (const n of notes) {
    const id = `${n.code}|${n.rule ?? ''}`;
    const e = by.get(id);
    if (e) e.lines.push(...n.lines); else by.set(id, { code: n.code, ...(n.rule === undefined ? {} : { rule: n.rule }), lines: [...n.lines] });
  }
  return [...by.values()].map((e) => ({ ...e, lines: [...new Set(e.lines)] }));
}

// ---------------------------------------------------------------- a draft back into a model, and merging drafts

/** A draft as a reader's model (keys dropped, groups by reference), so drafts can be merged like readings. */
export function draftModel(draft: ImportDraft): MenuModel {
  const groups = new Map<string, MGroup>();
  for (const g of draft.groups) groups.set(g.key, newGroup(g.name, { translated: [...g.translated], selection: g.selection, min: g.min, max: g.max }));
  for (const g of draft.groups) {
    groups.get(g.key)!.options = g.options.map((o): MOption => newOption(o.name, o.price, {
      translated: [...o.translated], priceText: o.priceText, maxQty: o.maxQty, isDefault: o.default, opens: o.opens === null ? null : groups.get(o.opens) ?? null,
    }));
  }
  return {
    sections: draft.sections.map((s) => newSection(s.name, s.kind, {
      translated: [...s.translated], room: s.room,
      dishes: s.dishes.map((d) => newDish(d.name, {
        desc: d.desc, translated: [...d.translated], price: d.price, priceText: d.priceText, priceNote: d.priceNote, tags: [...d.tags], allergens: d.allergens,
        photo: d.photo, illustration: d.illustration,
        links: d.groups.flatMap((a) => (groups.has(a.group) ? [{ group: groups.get(a.group)!, min: a.min, max: a.max }] : [])),
      })),
    })),
  };
}

/**
 * Merges drafts of the same menu (overlapping screenshots read one by one, several pastes of one page): sections and
 * dishes that repeat become one, identical groups become one, and the order is the one every draft agrees with.
 * Idempotent (merging a draft with itself, or a merge with one of its inputs, changes nothing) and independent of the
 * drafts' order wherever their own orders decide it. `dropped` is the largest of the drafts' (a merge cannot tell
 * which of their unread lines were the same ones). All drafts must have the same source.
 */
export function mergeDrafts(drafts: readonly ImportDraft[]): ReadResult {
  const source = drafts[0]?.source;
  if (source === undefined) throw new RangeError('mergeDrafts needs at least one draft');
  if (drafts.some((d) => d.source !== source)) throw new RangeError('mergeDrafts: the drafts have different sources');
  const dropped = Math.max(...drafts.map((d) => d.dropped));
  return buildDraft(source, drafts.map((d, i) => ({ model: draftModel(d), notes: [], dropped: i === 0 ? dropped : 0 })));
}
