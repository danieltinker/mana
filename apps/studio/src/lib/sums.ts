// Small sums with no browser and no network in them, so they can be tested alone (test/unit): what the dashboard draws
// from my_stats, what changed between two versions of a menu, and how two dish names are compared.

/** Change against the week before, in whole percent; null when there is nothing to compare with. */
export function weekChange(views7: number, prev7: number): number | null {
  if (!prev7) return null;
  return Math.round(((views7 - prev7) / prev7) * 100);
}
/** A share as a whole percent of a total; 0 when the total is 0. */
export const share = (part: number, total: number) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

/** A line and the area under it for a row of numbers, inside w × h (y grows downwards, 2 px kept clear at the top). */
export function sparkPaths(values: number[], w: number, h: number): { line: string; area: string; last: [number, number] } {
  const n = values.length, max = Math.max(1, ...values), top = 2, floor = h - 1;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * w : w / 2), y = (v: number) => floor - (Math.max(0, v) / max) * (floor - top);
  const pts = values.map((v, i) => [Number(x(i).toFixed(1)), Number(y(v).toFixed(1))] as [number, number]);
  if (!pts.length) return { line: '', area: '', last: [0, floor] };
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  return { line, area: `${line} L${pts[n - 1][0]} ${h} L${pts[0][0]} ${h} Z`, last: pts[n - 1] };
}
/** Heights (0…1) for a row of bars; the tallest is 1, and anything above zero stays visible. */
export function barHeights(values: number[], floor = 0.06): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 && v > 0 ? Math.max(floor, v / max) : 0));
}
/** The busiest stretch of the day, as [from, to) hours; null without data. */
export function peakHours(hours: number[], span = 3): [number, number] | null {
  if (!hours.some((v) => v > 0)) return null;
  let best = 0, at = 0;
  for (let i = 0; i < 24; i++) { let s = 0; for (let k = 0; k < span; k++) s += hours[(i + k) % 24] || 0; if (s > best) { best = s; at = i; } }
  return [at, (at + span) % 24];
}

export type Diff = { added: number; removed: number; changed: number; look: boolean; order: boolean };
/** What publishing now would change for guests: dishes added, removed, changed; the look; the order. "Sold out" alone is not a change (guests see it at once). */
export function diffSnapshots(pub: any, cur: any): Diff {
  const flat = (s: any) => { const m = new Map<string, string>(); for (const c of s.categories || []) for (const i of c.items || []) m.set(i.id, JSON.stringify({ ...i, available: undefined, cat: c.id })); return m; };
  const a = flat(pub), b = flat(cur);
  let added = 0, removed = 0, changed = 0;
  for (const [id, v] of b) { if (!a.has(id)) added++; else if (a.get(id) !== v) changed++; }
  for (const id of a.keys()) if (!b.has(id)) removed++;
  const shape = (s: any) => JSON.stringify((s.categories || []).map((c: any) => [c.id, c.name, c.kind, c.scene, (c.items || []).map((i: any) => i.id)]));
  const look = JSON.stringify([pub.business, pub.theme, pub.locale]) !== JSON.stringify([cur.business, cur.theme, cur.locale]);
  return { added, removed, changed, look, order: shape(pub) !== shape(cur) };
}

/** A name as it is compared: case, Hebrew points, punctuation and extra spaces do not count. */
export const norm = (s: string) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
