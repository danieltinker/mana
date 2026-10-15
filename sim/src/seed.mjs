// Seeds: a venue described as JSON, loaded through the owner bot (create_venue, then the menu tables under RLS),
// published, and approved by a Halom bot when the first publish waits for review.
//
// In the repository: sim/seeds/*.json, SYNTHETIC only (invented names and prices; each says "synthetic": true).
// Private seeds of real venues (the mock client's demo) live in private/ at the repository root, which git ignores; they
// are never committed, never pasted into a PR, never loaded into a public page.
//
// The shape (every "key" is the seed's own name for a row, used to point at it from elsewhere in the file):
// {
//   "synthetic": true,
//   "venue": { "slug": "cafe-demo", "name": { "he": "…", "en": "…" }, "kind": "cafe", "defaultLang": "he", "demo": true,
//              "cuisine": { "he": "…", "en": "…" }, "accent": "#c8743c" },
//   "schedules": [{ "key": "breakfast", "kind": "day_part" | "special", "name": {…}, "windows": [{ "days": [0…6], "from": "07:00", "to": "12:00" }] }],
//   "groups": [{ "key": "side", "label": "the owner's own label", "name": {…}, "selection": "single" | "multiple", "min": 1, "max": 1,
//                "options": [{ "key": "fries", "name": {…}, "price": 0, "maxQty": 1, "default": true, "opens": "sauce" }] }],
//   "sections": [{ "key": "mains", "name": {…}, "kind": "food", "schedule": "breakfast",
//                  "dishes": [{ "key": "burger", "name": {…}, "desc": {…}, "price": 6800, "tags": ["vegan"], "stock": "croissant",
//                               "schedule": null, "groups": ["side", { "group": "extras", "max": 2 }], "related": ["lemonade"] }] }],
//   "rules": [{ "key": "r1", "label": "…", "trigger": "sheet" | "add" | "checkout", "scope": "all" | { "dishes": [keys] } | { "sections": [keys] },
//               "when": { "days": [], "from": "07:00", "to": "11:00" }, "basketHas": { "dishes": [], "sections": [] }, "basketLacks": {…},
//               "suggest": { "dish": key } | { "option": key }, "line": {…}, "priority": 50, "cap": 1 }],
//   "hours": [{ "days": [0, 1, 2, 3, 4], "opens": "07:00", "closes": "23:00" }],
//   "closures": [{ "from": "2026-12-25", "to": "2026-12-25", "note": {…} }],
//   "onboarding": ["menu", "review", "addons", "hours"],
//   "publish": { "note": "…" }            (omit or false to leave the menu unpublished)
// }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HalomBot } from './halom.mjs';
import { OwnerBot } from './owner.mjs';

export const SEEDS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seeds');
export const PRIVATE = path.resolve(SEEDS, '../../private');

/** Problems with a seed's shape and references (an empty list = fine). The database checks everything else. */
export function seedProblems(seed) {
  const out = [];
  const keys = { schedules: new Set(), groups: new Set(), options: new Set(), sections: new Set(), dishes: new Set(), rules: new Set() };
  const uniq = (kind, k, where) => {
    if (typeof k !== 'string' || !k) return out.push(`${where}: a "key" is needed`);
    if (keys[kind].has(k)) out.push(`${where}: key "${k}" used twice`);
    keys[kind].add(k);
  };
  if (!seed || typeof seed !== 'object') return ['not an object'];
  if (!seed.venue?.slug) out.push('venue.slug is needed');
  (seed.schedules ?? []).forEach((s, i) => uniq('schedules', s.key, `schedules[${i}]`));
  (seed.groups ?? []).forEach((g, i) => { uniq('groups', g.key, `groups[${i}]`); (g.options ?? []).forEach((o, j) => uniq('options', o.key, `groups[${i}].options[${j}]`)); });
  (seed.sections ?? []).forEach((s, i) => { uniq('sections', s.key, `sections[${i}]`); (s.dishes ?? []).forEach((d, j) => uniq('dishes', d.key, `sections[${i}].dishes[${j}]`)); });
  (seed.rules ?? []).forEach((r, i) => uniq('rules', r.key, `rules[${i}]`));
  const ref = (kind, k, where) => { if (k != null && !keys[kind].has(k)) out.push(`${where}: unknown ${kind.slice(0, -1)} "${k}"`); };
  (seed.groups ?? []).forEach((g, i) => (g.options ?? []).forEach((o, j) => ref('groups', o.opens, `groups[${i}].options[${j}].opens`)));
  (seed.sections ?? []).forEach((s, i) => {
    ref('schedules', s.schedule, `sections[${i}].schedule`);
    (s.dishes ?? []).forEach((d, j) => {
      const w = `sections[${i}].dishes[${j}]`;
      ref('schedules', d.schedule, w + '.schedule');
      (d.groups ?? []).forEach((g) => ref('groups', typeof g === 'string' ? g : g.group, w + '.groups'));
      (d.related ?? []).forEach((r) => ref('dishes', r, w + '.related'));
    });
  });
  (seed.rules ?? []).forEach((r, i) => {
    const w = `rules[${i}]`;
    if (r.scope && r.scope !== 'all') { (r.scope.dishes ?? []).forEach((k) => ref('dishes', k, w + '.scope')); (r.scope.sections ?? []).forEach((k) => ref('sections', k, w + '.scope')); }
    for (const m of ['basketHas', 'basketLacks']) { (r[m]?.dishes ?? []).forEach((k) => ref('dishes', k, `${w}.${m}`)); (r[m]?.sections ?? []).forEach((k) => ref('sections', k, `${w}.${m}`)); }
    if (r.suggest?.dish) ref('dishes', r.suggest.dish, w + '.suggest'); else if (r.suggest?.option) ref('options', r.suggest.option, w + '.suggest');
    else out.push(w + '.suggest: { "dish": key } or { "option": key }');
  });
  return out;
}

/** Reads a seed file. Files in the repository must say "synthetic": true; real venues belong in private/. */
export function readSeed(file) {
  const abs = path.resolve(file);
  const seed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const inPrivate = abs.startsWith(PRIVATE + path.sep);
  if (!inPrivate && seed.synthetic !== true) {
    throw new Error(`${file}: a seed outside private/ must be synthetic ("synthetic": true). Real venues' seeds live in private/ (git-ignored).`);
  }
  const problems = seedProblems(seed);
  if (problems.length) throw new Error(`${file}:\n  ${problems.join('\n  ')}`);
  return { seed, private: inPrivate };
}

/**
 * Loads a seed through the bots: the owner signs up, creates the venue, builds the menu, publishes; the venue is
 * flagged as a demo (setup: no RPC sets is_demo yet); a Halom bot approves the first publish when it waits for review.
 * @param stack the local stack (sim/stack/start.mjs)
 * @param o.slug   another slug than the seed's (to load one seed twice)
 * @param o.halom  a HalomBot to approve with (a first admin is made when none is given and approval is needed)
 */
export async function loadSeed(stack, seed, { slug = seed.venue.slug, ownerEmail = `owner.${slug}@example.invalid`, halom = null,
  approveReason = 'Synthetic demo venue, loaded by the simulator' } = {}) {
  const owner = await OwnerBot.signUp(stack, { email: ownerEmail });
  const v = seed.venue;
  const made = await owner.createVenue({ slug, name: v.name, kind: v.kind ?? 'cafe', defaultLang: v.defaultLang ?? 'he' });
  if (!made.ok) throw new Error(`create_venue ${slug}: ${JSON.stringify(made)}`);
  if (v.demo !== false) await stack.setDemo(owner.venueId, true);
  const patch = {};
  if (v.cuisine) { patch.cuisine_he = v.cuisine.he ?? ''; patch.cuisine_en = v.cuisine.en ?? ''; }
  if (v.area) { patch.area_he = v.area.he ?? ''; patch.area_en = v.area.en ?? ''; }
  if (v.accent) patch.accent = v.accent;
  if (v.langs) patch.langs = v.langs;
  if (Object.keys(patch).length) await owner.updateVenue(patch);
  const ids = await owner.buildMenu(seed);
  await owner.setOnboarding(seed.onboarding ?? ['menu', 'review', 'addons', 'hours']);
  let published = null;
  let approved = null;
  if (seed.publish !== false) {
    published = await owner.publish(seed.publish?.note ?? 'simulator seed');
    if (!published.ok) throw new Error(`publish_menu ${slug}: ${JSON.stringify(published)}`);
    if (published.review === 'pending') {
      const staff = halom ?? (await HalomBot.firstAdmin(stack, stack, { email: `admin.${slug}@example.invalid` }));
      approved = await staff.approve(owner.venueId, approveReason);
      if (!approved.ok) throw new Error(`ops_approve_venue ${slug}: ${JSON.stringify(approved)}`);
    }
  }
  return { owner, venueId: owner.venueId, slug, ids, published, approved };
}
