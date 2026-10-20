// The walkthrough's record (D38): every step of a run on all three sides, each with its name, its side, when it
// started, how long it took against its budget, one screenshot, a one-line caption, and its verdict with the reason.
// The first step that fails stops the run: the steps after it are listed as not run, so the page shows how far the chain
// got. A step may also be skipped (something not available in this environment, said plainly); a skip does not stop it.
//
//   const w = new Walkthrough({ outDir, log });
//   await w.step({ id: 'owner-signup', name: 'The owner signs up', side: 'owner', budgetMs: 20_000, page }, async (s) => {
//     …                                    // drive the app; s.page is where the screenshot is taken (change it if needed)
//     return 'Signed up with a fresh demo address';
//   });
//   w.summary()   // { passed, failed, skipped, notRun, total, ms }
import fs from 'node:fs';
import path from 'node:path';

/** The three sides, as the page names them. */
export const SIDES = { owner: 'The owner', staff: 'Halom', guest: 'A guest' };
/** What a step can come to. */
export const VERDICTS = ['pass', 'fail', 'skip', 'not_run'];

/** The first line of an error, short enough for one line of a page (Playwright's messages run to many lines). */
export function reasonOf(e) {
  const text = e instanceof Error ? e.message : String(e);
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? 'failed';
  return line.length > 300 ? line.slice(0, 297) + '…' : line;
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

export class Walkthrough {
  /**
   * @param {{ outDir: string, log?: (line: string) => void }} o
   *   outDir  the run's folder: shots/ (one JPEG per step) goes in it, emptied first
   *   log     one line per step on the terminal: its number, side, name, time and verdict (never its caption, which may
   *           quote a private menu)
   */
  constructor({ outDir, log = () => {} }) {
    this.outDir = outDir;
    this.shotsDir = path.join(outDir, 'shots');
    fs.rmSync(this.shotsDir, { recursive: true, force: true });
    fs.mkdirSync(this.shotsDir, { recursive: true });
    this.log = log;
    /** @type {StepRecord[]} */
    this.steps = [];
    this.failed = null;
    this.startedAt = new Date();
    this.t0 = performance.now();
  }

  /**
   * Runs one step and records it.
   * @param {{ id: string, name: string, side: keyof typeof SIDES, budgetMs: number, page?: import('playwright-core').Page }} def
   * @param {(s: StepContext) => Promise<string | { caption: string, value?: unknown }>} fn  returns the caption (and a value)
   * @returns the step's value, or null when it did not run or failed
   */
  async step({ id, name, side, budgetMs, page = null }, fn) {
    if (!SIDES[side]) throw new Error(`step ${id}: no side "${side}"`);
    /** @type {StepRecord} */
    const rec = { n: this.steps.length + 1, id, name, side, budgetMs, startedAt: null, ms: 0, waitedMs: 0, verdict: 'not_run', reason: '', caption: '', shot: null, frame: null };
    this.steps.push(rec);
    if (this.failed) {
      rec.reason = `Not run: step ${this.failed.n} failed.`;
      this.log(`  ${String(rec.n).padStart(2, '0')} ${side.padEnd(5)} ${name} · not run`);
      return null;
    }
    const file = `${String(rec.n).padStart(2, '0')}-${id}.jpg`;
    /** @type {StepContext} */
    const s = {
      page,
      shotTaken: false,
      skipped: null,
      /** The screenshot, now (by default it is taken when the step ends). */
      async shot(p = s.page) {
        if (!p) return;
        await p.screenshot({ path: path.join(this.shotsDir, file), type: 'jpeg', quality: 78, animations: 'disabled', caret: 'hide' });
        rec.shot = 'shots/' + file;
        rec.frame = (p.viewportSize()?.width ?? 0) < 700 ? 'phone' : 'desk';
        s.shotTaken = true;
      },
      /** Time spent waiting for a person (an e-mail confirmation): kept out of the budget, and shown. */
      waited(ms) { rec.waitedMs += ms; },
      /** The step cannot be done here (said plainly); the run goes on. */
      skip(reason) { s.skipped = reason; },
    };
    rec.startedAt = new Date().toISOString();
    const t0 = performance.now();
    let out = null;
    try {
      out = await fn(s);
      rec.ms = Math.round(performance.now() - t0);
      rec.caption = typeof out === 'string' ? out : out?.caption ?? '';
      const worked = rec.ms - rec.waitedMs;
      if (s.skipped) { rec.verdict = 'skip'; rec.reason = s.skipped; }
      else if (worked > budgetMs) {
        rec.verdict = 'fail';
        rec.reason = `Took ${seconds(worked)}${rec.waitedMs ? ` (without ${seconds(rec.waitedMs)} of waiting)` : ''}; the budget is ${seconds(budgetMs)}.`;
        this.failed = rec;
      } else rec.verdict = 'pass';
      if (!s.shotTaken) await s.shot().catch(() => {});
    } catch (e) {
      rec.ms = Math.round(performance.now() - t0);
      rec.verdict = 'fail';
      rec.reason = reasonOf(e);
      this.failed = rec;
      await s.shot().catch(() => {});
    }
    const mark = { pass: '✓', fail: '✗', skip: '–' }[rec.verdict];
    this.log(`${mark} ${String(rec.n).padStart(2, '0')} ${side.padEnd(5)} ${name} · ${seconds(rec.ms)}${rec.verdict === 'skip' ? ' · not available here' : ''}${rec.verdict === 'fail' ? ' · failed' : ''}`);
    return rec.verdict === 'pass' || rec.verdict === 'skip' ? (typeof out === 'object' && out ? out.value ?? null : null) : null;
  }

  /** How the run went: steps by verdict, and its whole time. */
  summary() {
    const n = (v) => this.steps.filter((s) => s.verdict === v).length;
    return { passed: n('pass'), failed: n('fail'), skipped: n('skip'), notRun: n('not_run'), total: this.steps.length, ms: Math.round(performance.now() - this.t0) };
  }

  /** The run as plain data (walkthrough.json beside the page). */
  toJSON() {
    return { startedAt: this.startedAt.toISOString(), summary: this.summary(), steps: this.steps };
  }
}

/**
 * @typedef {{ n: number, id: string, name: string, side: keyof typeof SIDES, budgetMs: number, startedAt: string | null, ms: number,
 *   waitedMs: number, verdict: 'pass' | 'fail' | 'skip' | 'not_run', reason: string, caption: string, shot: string | null,
 *   frame: 'phone' | 'desk' | null }} StepRecord
 * @typedef {{ page: import('playwright-core').Page | null, shotTaken: boolean, skipped: string | null,
 *   shot: (p?: import('playwright-core').Page) => Promise<void>, waited: (ms: number) => void, skip: (reason: string) => void }} StepContext
 */
