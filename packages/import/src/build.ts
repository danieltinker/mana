/**
 * One draft from what one or more readings produced (a paste, several screenshots, several pastes of the same page):
 * the step every reader ends with, and `mergeDrafts`.
 *
 * - **Same node.** Two sections are the same when their names have the same `importKey` in the language the source
 *   printed (Hebrew first; a translated name never decides). Two dishes are the same when they are in the same section
 *   and have the same name, and their prices agree (one price, or none); a dish read with two different prices stays
 *   two dishes, and the draft's `dish_duplicate` exception lets the owner choose. Two option groups are the same when
 *   everything about them is: names, choice, limits, and each option's name, price, quantity, default and nested group.
 * - **Values.** Of the values the copies give, the printed one beats a translated one; a description cut short
 *   ("…") gives way to the full one it begins; then the most frequent; then the longest; then the first in code-unit
 *   order. Tags are joined. So the result does not depend on the order of the inputs.
 * - **Order.** One order that each input's own order agrees with (`mergeOrder`).
 * - **Keys** come from what a node is (`KeyMaker`), so reading the same text again gives the same keys.
 * - **Bounds.** Texts are cut to what the draft allows, limits a group cannot have are dropped, and past `DRAFT_CAPS`
 *   the rest is left out, each with a note: every draft built here passes `validateDraft`.
 */
import {
  DRAFT_CAPS, draftGroupLimits, GROUP_UNITS_MAX, isBlank, isInt, LANGS, LIMITS, PRICE_TEXT_MAX, ROOMS, SECTION_KINDS, stripBlank, TAGS, importKey,
  type DraftDish, type DraftDishGroup, type DraftGroup, type DraftOption, type DraftPhoto, type DraftSection, type ImportDraft, type ImportSource,
  type Lang, type Room, type SectionKind, type Text,
} from '@mana/contracts';
import { KeyMaker } from './keys.ts';
import { newDish, newGroup, newOption, newSection, type MDish, type MenuModel, type MGroup, type MLink, type MOption, type MSection } from './model.ts';
import { NoteBook, type PendingNote, type ReaderNote } from './notes.ts';
import { mergeOrder, type Rank } from './order.ts';
import { clip } from './text.ts';

/** What a reader returns: the draft, the notes on the source, and how many source lines it could not read. */
export type ReadResult = { readonly draft: ImportDraft; readonly notes: readonly ReaderNote[]; readonly dropped: number };
/** One reading, before the draft: a reader's model, its whole-input notes and its unread line count. */
export type Reading = { readonly model: MenuModel; readonly notes: readonly ReaderNote[]; readonly dropped: number };

const STOCK_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const NAME_MAX = { section: 60, group: 60, option: 60, dish: LIMITS.nameLength } as const;
const ALLERGENS_MAX = 300;
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

function cutOf(t: string, u: string): boolean {
  const m = /^(.*\S)\s*(?:…|\.\.\.)$/u.exec(t);
  return m !== null && u !== t && u.length > m[1]!.length && u.startsWith(m[1]!);
}

function pick(cands: readonly Cand[]): Cand {
  const vals = cands.map((c) => ({ value: stripBlank(c.value), translated: c.translated })).filter((c) => c.value !== '');
  if (vals.length === 0) return { value: '', translated: false };
  const printed = vals.filter((c) => !c.translated);
  const count = new Map<string, number>();
  for (const c of printed.length ? printed : vals) count.set(c.value, (count.get(c.value) ?? 0) + 1);
  const distinct = [...count.keys()];
  const full = distinct.filter((t) => !distinct.some((u) => cutOf(t, u)));
  const best = full.sort((a, b) => count.get(b)! - count.get(a)! || [...b].length - [...a].length || cmp(a, b))[0]!;
  return { value: best, translated: printed.length === 0 };
}

/** A bilingual text picked language by language, and the languages whose pick was a translation. */
function pickText(items: ReadonlyArray<{ text: Text; translated: readonly Lang[] }>): { text: Text; translated: Lang[] } {
  const he = pick(items.map((i) => ({ value: i.text.he, translated: i.translated.includes('he') })));
  const en = pick(items.map((i) => ({ value: i.text.en, translated: i.translated.includes('en') })));
  return { text: { he: he.value, en: en.value }, translated: LANGS.filter((l) => (l === 'he' ? he : en).translated && (l === 'he' ? he : en).value !== '') };
}

const printedText = (texts: readonly Text[]): Text => pickText(texts.map((text) => ({ text, translated: [] }))).text;

function mostFrequent<T extends string>(values: readonly T[], order: readonly T[]): T | null {
  if (values.length === 0) return null;
  const count = new Map<T, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]) || cmp(a[0], b[0]))[0]![0];
}

const allSame = <T>(values: readonly T[]): T | null => (values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null);

// ---------------------------------------------------------------- normalising one reading (a copy; inputs are left as they are)

function within(lim: { min: number | null; max: number | null }, selection: 'single' | 'multiple'): boolean {
  const { min, max } = lim;
  const lo = min === null || (isInt(min) && min >= 0 && min <= GROUP_UNITS_MAX);
  const hi = max === null || (isInt(max) && max >= 1 && max <= GROUP_UNITS_MAX);
  if (!lo || !hi || (min !== null && max !== null && min > max)) return false;
  return selection === 'multiple' || ((min ?? 0) <= 1 && (max === null || max === 1));
}

function clipText(t: Text, max: number, notes: PendingNote[], line: number | null): Text {
  const he = clip(stripBlank(t.he), max), en = clip(stripBlank(t.en), max);
  if (he.clipped || en.clipped) notes.push({ code: 'text_clipped', lines: line === null ? [] : [line] });
  return { he: he.text, en: en.text };
}

const translatedOf = (tr: readonly Lang[], ...texts: Text[]): Lang[] => LANGS.filter((l) => tr.includes(l) && texts.some((t) => !isBlank(t[l])));
const named = (t: Text): boolean => !isBlank(t.he) || !isBlank(t.en);

function normalise(model: MenuModel): MenuModel {
  const groups = new Map<MGroup, MGroup | null>();
  const group = (g: MGroup): MGroup | null => {
    if (groups.has(g)) return groups.get(g)!;
    const notes: PendingNote[] = [...g.notes];
    const name = clipText(g.name, NAME_MAX.group, notes, null);
    if (!named(name)) { groups.set(g, null); return null; }
    const copy = newGroup(name, { translated: translatedOf(g.translated, name), selection: g.selection, notes });
    groups.set(g, copy);
    if (within(g, g.selection)) { copy.min = g.min; copy.max = g.max; } else notes.push({ code: 'limits_dropped', lines: [] });
    for (const o of g.options) {
      const oname = clipText(o.name, NAME_MAX.option, notes, null);
      if (!named(oname)) continue;
      const opens = o.opens ? group(o.opens) : null;
      const price = isInt(o.price) && o.price >= 0 && o.price <= LIMITS.price ? o.price : null;
      const text = price === null && o.priceText !== null && !isBlank(o.priceText) ? clip(stripBlank(o.priceText), PRICE_TEXT_MAX).text : null;
      copy.options.push(newOption(oname, price, {
        translated: translatedOf(o.translated, oname), priceText: text,
        maxQty: opens ? 1 : Math.min(Math.max(isInt(o.maxQty) ? o.maxQty : 1, 1), LIMITS.optionQuantity), isDefault: o.isDefault === true, opens,
      }));
    }
    if (copy.options.length === 0) { groups.set(g, null); return null; }
    // only the fields `draftGroupLimits` reads
    const lim = draftGroupLimits({ selection: copy.selection, min: copy.min, max: copy.max, options: copy.options } as unknown as DraftGroup);
    if (copy.options.filter((o) => o.isDefault).length > lim.max) {
      for (const o of copy.options) o.isDefault = false;
      notes.push({ code: 'defaults_cleared', lines: [] });
    }
    return copy;
  };

  const sections: MSection[] = [];
  for (const s of model.sections) {
    const notes: PendingNote[] = [...s.notes];
    const name = clipText(s.name, NAME_MAX.section, notes, s.line);
    if (!named(name)) continue;
    const copy = newSection(name, (SECTION_KINDS as readonly string[]).includes(s.kind) ? s.kind : 'food', {
      translated: translatedOf(s.translated, name), room: s.room !== null && (ROOMS as readonly string[]).includes(s.room) ? s.room : null, notes, line: s.line,
    });
    for (const d of s.dishes) {
      const dn: PendingNote[] = [...d.notes];
      const dname = clipText(d.name, NAME_MAX.dish, dn, d.line);
      if (!named(dname)) continue;
      const desc = clipText(d.desc, LIMITS.descLength, dn, d.line);
      const price = isInt(d.price) && d.price >= 0 && d.price <= LIMITS.price ? d.price : null;
      const links: MLink[] = [];
      for (const a of d.links) {
        const g = group(a.group);
        if (g && !links.some((l) => l.group === g)) links.push({ group: g, min: a.min, max: a.max });
      }
      copy.dishes.push(newDish(dname, {
        desc, translated: translatedOf(d.translated, dname, desc), price,
        priceText: price === null && d.priceText !== null && !isBlank(d.priceText) ? clip(stripBlank(d.priceText), PRICE_TEXT_MAX).text : null,
        priceNote: clipText(d.priceNote, LIMITS.noteLength, dn, d.line), tags: TAGS.filter((t) => d.tags.includes(t)),
        allergens: clipText(d.allergens, ALLERGENS_MAX, dn, d.line), photo: d.photo,
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

/** Builds the draft of `source` from one or more readings of the same menu. */
export function buildDraft(source: ImportSource, readings: readonly Reading[]): ReadResult {
  const book = new NoteBook();
  let dropped = 0;
  for (const r of readings) {
    dropped += r.dropped;
    for (const n of r.notes) book.add(n.code, n.lines, { key: n.key, rule: n.rule, count: n.count });
  }
  const models = readings.map((r) => normalise(r.model));

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
      parts.sort((a, b) => cmpRank(a.occs[0]!.rank, b.occs[0]!.rank));
      dishes.push(...parts);
    }
    plan.push({ id: sid, occs, dishes });
  }

  // ---- bounds on sections and dishes
  const keptSections = plan.filter((p) => p.dishes.length > 0);
  for (const p of plan) if (p.dishes.length === 0) book.add('section_empty', p.occs.map((o) => o.s.line).filter((l): l is number => l !== null), { count: 1 });
  if (keptSections.length > DRAFT_CAPS.sections) book.add('caps_reached', [], { rule: 'sections', count: keptSections.length - DRAFT_CAPS.sections });
  const sections = keptSections.slice(0, DRAFT_CAPS.sections);
  let dishBudget = DRAFT_CAPS.dishes, dishesLeft = 0;
  for (const p of sections) {
    const keep = Math.min(p.dishes.length, dishBudget);
    dishesLeft += p.dishes.length - keep;
    p.dishes = p.dishes.slice(0, keep);
    dishBudget -= keep;
  }
  if (dishesLeft > 0) book.add('caps_reached', [], { rule: 'dishes', count: dishesLeft });
  const live = sections.filter((p) => p.dishes.length > 0);

  // ---- each dish's groups (merged in order), and every group reached from them
  const sigOf = new Map<MGroup, string>();
  const sig = (g: MGroup): string => { let s = sigOf.get(g); if (s === undefined) sigOf.set(g, (s = signature(g))); return s; };
  const groupOccs = new Map<string, MGroup[]>();
  const groupOrder: string[] = [];
  const visit = (g: MGroup, path: Set<MGroup>): void => {
    if (path.has(g)) return;
    const s = sig(g);
    if (!groupOccs.has(s)) { groupOccs.set(s, []); groupOrder.push(s); }
    const list = groupOccs.get(s)!;
    if (!list.includes(g)) list.push(g);
    const inner = new Set(path).add(g);
    for (const o of g.options) if (o.opens) visit(o.opens, inner);
  };
  type DishLinks = Array<{ sig: string; min: number | null; max: number | null }>;
  const linksOf = new Map<string, DishLinks>();
  let linksLeft = 0;
  for (const p of live) for (const m of p.dishes) {
    const seqs = m.occs.map((o) => o.d.links.map((a) => sig(a.group)));
    const rank = new Map<string, Rank>();
    m.occs.forEach((o) => o.d.links.forEach((a, k) => { const s = sig(a.group); if (!rank.has(s)) rank.set(s, [...o.rank, k]); }));
    const order = mergeOrder(seqs, rank);
    linksLeft += Math.max(0, order.length - DRAFT_CAPS.groupsPerDish);
    const links: DishLinks = order.slice(0, DRAFT_CAPS.groupsPerDish).map((s) => {
      const all = m.occs.flatMap((o) => o.d.links.filter((a) => sig(a.group) === s));
      for (const a of all) visit(a.group, new Set());
      return { sig: s, min: allSame(all.map((a) => a.min)), max: allSame(all.map((a) => a.max)) };
    });
    linksOf.set(m.id, links);
  }
  if (linksLeft > 0) book.add('caps_reached', [], { rule: 'groupsPerDish', count: linksLeft });
  let groupsKept = new Set(groupOrder.slice(0, DRAFT_CAPS.groups));
  if (groupOrder.length > DRAFT_CAPS.groups) book.add('caps_reached', [], { rule: 'groups', count: groupOrder.length - DRAFT_CAPS.groups });
  // a group is kept only when a kept dish, or a kept option of a kept group, still reaches it
  for (;;) {
    const reached = new Set<string>();
    const reach = (s: string): void => {
      if (!groupsKept.has(s) || reached.has(s)) return;
      reached.add(s);
      for (const o of groupOccs.get(s)![0]!.options.slice(0, DRAFT_CAPS.optionsPerGroup)) if (o.opens) reach(sig(o.opens));
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
    const v = pickText(groupOccs.get(s)!.map((g) => ({ text: g.name, translated: g.translated })));
    groupName.set(s, v);
    groupKey.set(s, keys.make('g', v.text.en, s));
  }

  // ---- the draft's nodes
  const notesOn = (key: string, notes: readonly PendingNote[]): void => { for (const n of notes) book.add(n.code, n.lines, { key, count: 1 }); };
  const groups: DraftGroup[] = [];
  let optionsLeft = 0;
  for (const s of keptOrder) {
    const occs = groupOccs.get(s)!;
    const first = occs[0]!;
    const key = groupKey.get(s)!;
    const name = groupName.get(s)!;
    optionsLeft += Math.max(0, first.options.length - DRAFT_CAPS.optionsPerGroup);
    const options: DraftOption[] = first.options.slice(0, DRAFT_CAPS.optionsPerGroup).map((o, j) => {
      const v = pickText(occs.map((g) => ({ text: g.options[j]!.name, translated: g.options[j]!.translated })));
      const opened = o.opens ? sig(o.opens) : null;
      return {
        key: keys.make('o', v.text.en, `${s}/${j}`), name: v.text, translated: v.translated, price: o.price, priceText: o.price === null ? o.priceText : null,
        maxQty: o.maxQty, default: o.isDefault, opens: opened !== null && groupsKept.has(opened) ? groupKey.get(opened)! : null,
      };
    });
    groups.push({ key, name: name.text, translated: name.translated, selection: first.selection, min: first.min, max: first.max, options });
    notesOn(key, dedupeNotes(occs.flatMap((g) => g.notes)));
  }
  if (optionsLeft > 0) book.add('caps_reached', [], { rule: 'optionsPerGroup', count: optionsLeft });
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
        allergens: printedText(ds.map((d) => d.allergens)), photo: photoOf(ds), illustration: mostFrequent(ds.map((d) => d.illustration).filter((x): x is string => x !== null), []),
        groups: links,
      };
    });
    const kind: SectionKind = mostFrequent(p.occs.map((o) => o.s.kind), SECTION_KINDS) ?? 'food';
    const room: Room | null = mostFrequent(p.occs.map((o) => o.s.room).filter((r): r is Room => r !== null), ROOMS);
    return { key, name: sv.text, translated: sv.translated, kind, room, dishes };
  });

  return { draft: { v: 1, source, sections: draftSections, groups }, notes: book.list(), dropped };
}

/** A dish's own limits on a group, only when they tighten the group's (else the group's own: null). */
function tightening(g: DraftGroup, min: number | null, max: number | null): { min: number | null; max: number | null } {
  if (min === null && max === null) return { min, max };
  const own = draftGroupLimits(g);
  const ok = within({ min, max }, g.selection) && (min === null || min >= own.min) && (max === null || max <= own.max);
  return ok ? { min, max } : { min: null, max: null };
}

function photoOf(dishes: readonly MDish[]): DraftPhoto | null {
  const photos = dishes.map((d) => d.photo).filter((p): p is DraftPhoto => p !== null).sort((a, b) => cmp(a.path, b.path));
  if (photos.length === 0) return null;
  const path = photos[0]!.path;
  return { path, rights: photos.filter((p) => p.path === path).every((p) => p.rights === 'confirmed') ? 'confirmed' : 'unknown' };
}

function dedupeNotes(notes: readonly PendingNote[]): PendingNote[] {
  const by = new Map<string, number[]>();
  for (const n of notes) by.set(n.code, [...(by.get(n.code) ?? []), ...n.lines]);
  return [...by.entries()].map(([code, lines]) => ({ code: code as PendingNote['code'], lines: [...new Set(lines)] }));
}

function cmpRank(a: Rank, b: Rank): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d; }
  return 0;
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
 * drafts' order wherever their own orders decide it. All drafts must have the same source.
 */
export function mergeDrafts(drafts: readonly ImportDraft[]): ReadResult {
  const source = drafts[0]?.source;
  if (source === undefined) throw new RangeError('mergeDrafts needs at least one draft');
  if (drafts.some((d) => d.source !== source)) throw new RangeError('mergeDrafts: the drafts have different sources');
  return buildDraft(source, drafts.map((d) => ({ model: draftModel(d), notes: [], dropped: 0 })));
}
