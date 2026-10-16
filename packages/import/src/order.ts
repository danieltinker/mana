/**
 * The order of merged nodes: one order that every input's own order agrees with (each input says "a comes before b"
 * for the nodes it shows one after another). So overlapping screenshots or pastes give the same order whichever is
 * read first. Where the inputs say nothing about two nodes (no overlap between them), the tie-break decides: the node
 * first seen in the earlier input. Where they contradict each other (a cycle), the node with the smallest id goes
 * first, whatever the order of the inputs, so a contradiction never makes the result depend on which input came first.
 *
 * Kahn's algorithm with two heaps (the nodes nothing waits on, and every node left, for a contradiction):
 * O((nodes + edges) · log nodes), so a draft with thousands of options orders in milliseconds.
 */

export type Rank = readonly number[];

const before = (a: Rank, b: Rank): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
};

/** A min-heap of small integers (positions in rank order). */
class Heap {
  private readonly a: number[] = [];
  get size(): number { return this.a.length; }
  push(v: number): void {
    const a = this.a;
    a.push(v);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (a[p]! <= v) break;
      a[i] = a[p]!; a[p] = v; i = p;
    }
  }
  pop(): number {
    const a = this.a, top = a[0]!, last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l]! < a[m]!) m = l;
        if (r < a.length && a[r]! < a[m]!) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top;
  }
}

/**
 * @param seqs each input's ids in its order; an id that repeats inside one input counts at its first place
 * @param rank the tie-break: smaller first (every id of `seqs` must have one)
 */
export function mergeOrder(seqs: readonly (readonly string[])[], rank: ReadonlyMap<string, Rank>): string[] {
  if (rank.size <= 1) return [...rank.keys()];
  // nodes numbered by their place in rank order, so a smaller number is the earlier tie-break
  const ids = [...rank.keys()].sort((a, b) => before(rank.get(a)!, rank.get(b)!));
  const at = new Map(ids.map((id, i) => [id, i] as const));
  const next: Array<Set<number>> = ids.map(() => new Set());
  const indegree = new Int32Array(ids.length);
  for (const seq of seqs) {
    const seen = new Set<number>();
    let prev = -1;
    for (const id of seq) {
      const v = at.get(id);
      if (v === undefined || seen.has(v)) continue;
      seen.add(v);
      if (prev >= 0 && !next[prev]!.has(v)) { next[prev]!.add(v); indegree[v]! += 1; }
      prev = v;
    }
  }
  const done = new Uint8Array(ids.length);
  // the nodes in id order, for a contradiction
  const byId = ids.map((_, v) => v).sort((a, b) => (ids[a]! < ids[b]! ? -1 : ids[a]! > ids[b]! ? 1 : 0));
  const free = new Heap(), all = new Heap();
  for (let v = 0; v < ids.length; v++) { all.push(v); if (indegree[v] === 0) free.push(v); }
  const out: string[] = [];
  while (out.length < ids.length) {
    // a node nothing waits on wins, the smaller rank first; in a contradiction (none is free) the smallest id
    let v = -1;
    while (free.size > 0 && v < 0) { const c = free.pop(); if (!done[c]) v = c; }
    while (v < 0) { const c = byId[all.pop()]!; if (!done[c]) v = c; }
    done[v] = 1;
    out.push(ids[v]!);
    for (const w of next[v]!) {
      if (done[w]) continue;
      indegree[w]! -= 1;
      if (indegree[w] === 0) free.push(w);
    }
  }
  return out;
}
