// What publishing now would change for guests: the published revision's snapshot next to the draft's (preview_menu).
// Compared by value, ignoring what differs on every build (revision, time, storage address). Pure.
import type { SnapshotV2 } from '@mana/contracts';

export type MenuChanges = {
  readonly dishesAdded: number;
  readonly dishesRemoved: number;
  readonly dishesChanged: number;
  readonly groupsChanged: number;
  /** Sections renamed, added, removed or put in another order (or dishes moved between them). */
  readonly sections: boolean;
  /** The place's details, look, languages, schedules or suggestion rules. */
  readonly other: boolean;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function dishesOf(s: SnapshotV2): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const sec of s.sections) for (const d of sec.dishes) out.set(d.id, d);
  return out;
}

export function menuChanges(published: SnapshotV2, draft: SnapshotV2): MenuChanges {
  const before = dishesOf(published), after = dishesOf(draft);
  let dishesAdded = 0, dishesRemoved = 0, dishesChanged = 0;
  for (const [id, d] of after) {
    if (!before.has(id)) dishesAdded++;
    else if (!same(before.get(id), d)) dishesChanged++;
  }
  for (const id of before.keys()) if (!after.has(id)) dishesRemoved++;

  const gb = new Map(published.addonGroups.map((g) => [g.id, g] as const)), ga = new Map(draft.addonGroups.map((g) => [g.id, g] as const));
  let groupsChanged = 0;
  for (const [id, g] of ga) if (!same(gb.get(id), g)) groupsChanged++;
  for (const id of gb.keys()) if (!ga.has(id)) groupsChanged++;

  const outline = (s: SnapshotV2) => s.sections.map((x) => ({ id: x.id, name: x.name, kind: x.kind, scene: x.scene, room: x.room, scheduleId: x.scheduleId, dishes: x.dishes.map((d) => d.id) }));
  const rest = (s: SnapshotV2) => [s.venue, s.locale, s.pricing, s.theme, s.schedules, s.upsellRules];
  return { dishesAdded, dishesRemoved, dishesChanged, groupsChanged, sections: !same(outline(published), outline(draft)), other: !same(rest(published), rest(draft)) };
}

/**
 * Where the menu stands for guests: never published; published and waiting for Halom's approval (guests see
 * "unavailable"); live; or taken offline. The same reading as the database's app.review_of and public_menu.
 */
export type Standing = 'never' | 'pending' | 'live' | 'offline';
export function standingOf(v: { published_revision_id: string | null; first_published_at: string | null; approved_at: string | null }): Standing {
  if (!v.first_published_at) return 'never';
  if (!v.approved_at) return 'pending';
  return v.published_revision_id ? 'live' : 'offline';
}

export const anyChange = (c: MenuChanges): boolean =>
  c.dishesAdded + c.dishesRemoved + c.dishesChanged + c.groupsChanged > 0 || c.sections || c.other;
