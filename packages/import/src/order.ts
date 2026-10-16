/**
 * The order of merged nodes: one order that every input's own order agrees with (each input says "a comes before b"
 * for the nodes it shows one after another). So overlapping screenshots or pastes give the same order whichever is
 * read first. Where the inputs say nothing about two nodes (no overlap between them), or contradict each other, the
 * tie-break decides: the node first seen in the earlier input.
 */

export type Rank = readonly number[];

const before = (a: Rank, b: Rank): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
};

/**
 * @param seqs each input's ids in its order; an id that repeats inside one input counts at its first place
 * @param rank the tie-break: smaller first (every id of `seqs` must have one)
 */
export function mergeOrder(seqs: readonly (readonly string[])[], rank: ReadonlyMap<string, Rank>): string[] {
  const next = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const id of rank.keys()) { next.set(id, new Set()); indegree.set(id, 0); }
  for (const seq of seqs) {
    const seen = new Set<string>();
    let prev: string | null = null;
    for (const id of seq) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (prev !== null && !next.get(prev)!.has(id)) { next.get(prev)!.add(id); indegree.set(id, indegree.get(id)! + 1); }
      prev = id;
    }
  }
  const left = new Set(rank.keys());
  const out: string[] = [];
  while (left.size > 0) {
    let pick: string | null = null, pickFree = false;
    for (const id of left) {
      const free = indegree.get(id) === 0;
      // a node nothing waits on wins; among those (or, in a contradiction, among all) the smaller rank
      if (pick === null || (free && !pickFree) || (free === pickFree && before(rank.get(id)!, rank.get(pick)!) < 0)) { pick = id; pickFree = free; }
    }
    left.delete(pick!);
    out.push(pick!);
    for (const id of next.get(pick!)!) if (left.has(id)) indegree.set(id, indegree.get(id)! - 1);
  }
  return out;
}
