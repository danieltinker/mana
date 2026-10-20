// A small seeded random generator (mulberry32) so a random run can be replayed exactly: the same seed, the same menu
// and the same clock give the same guests doing the same things.
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hash(String(seed))) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);                       // 0 … n-1
  next.between = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)); // lo … hi
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  /** A fresh generator for one guest, from this one (so guests do not shift each other's choices). */
  next.fork = (label) => rng(hash(`${a}:${label}`));
  return next;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Always the first choice: the deterministic "rng" (minimum units, first available options). */
export const first = Object.assign(() => 0, { int: () => 0, between: (lo) => lo, pick: (l) => l[0], chance: () => false, fork: () => first });
