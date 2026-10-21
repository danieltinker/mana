// The walkthrough page (D38): one self-contained HTML file (styles, the Mana mark and every screenshot inside it), so it
// opens from the disk on a phone or a desk and can be passed around privately as one file. It is never published: a
// client's run writes it under private/ (git-ignored), the synthetic run under e2e/.out/ (git-ignored).
//
// The header says where the run happened (local: the simulator's stack; demo: the database `mana`), when, whether the
// menu was invented, and the result (steps passed of total, and the total time). Then every step in order, on its side,
// with its screenshot, caption, timing against its budget, and verdict.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIDES } from './record.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TZ = 'Asia/Jerusalem';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const secs = (ms) => (ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);
const clock = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const day = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const VERDICT = { pass: 'Passed', fail: 'Failed', skip: 'Not available here', not_run: 'Not run' };
const ENV = { local: 'Local: the simulator’s stack on this machine', demo: 'Demo: the database “mana”' };

/** The Mana mark, its strokes in the text colour (so it reads in light and dark). */
function mark() {
  try { return fs.readFileSync(path.join(ROOT, 'brand/assets/mana-mark-small.svg'), 'utf8').replace(/#0F0F0F/gi, 'currentColor').replace('<title>mana</title>', '').replace('role="img"', 'aria-hidden="true"'); }
  catch { return ''; }
}

/** The shared design tokens (design/tokens.css), inlined; the page falls back to its own values without them. */
function tokens() {
  try { return fs.readFileSync(path.join(ROOT, 'design/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); } catch { return ''; }
}

const CSS = `
:root { color-scheme: light dark; --bg: var(--m-porcelain, #f7f4ee); --card: #fff; --ink: var(--m-ink-warm, #16120e); --ink-2: var(--m-ink-warm-2, #4a433c);
  --line: rgba(22, 18, 14, .12); --ok: var(--m-ok, #2f7d4f); --bad: var(--m-bad, #b23a3a); --warn: var(--m-warn, #b7791f);
  --owner: #9a5238; --staff: #31588a; --guest: #2f7d4f; --shadow: var(--m-shadow-warm-s, 0 12px 28px -16px rgba(70, 45, 20, .38)); }
@media (prefers-color-scheme: dark) { :root { --bg: #14110e; --card: #1d1915; --ink: #f3ede6; --ink-2: #b9b0a6; --line: rgba(243, 237, 230, .14);
  --ok: #6fbf8b; --bad: #e07a7a; --warn: #e2b45a; --owner: #d9906f; --staff: #8fb1e0; --guest: #78c495; --shadow: none; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 64px; }
header.top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
header.top svg { width: 40px; height: 40px; flex: none; }
.kicker { margin: 0; font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); }
h1 { margin: 0; font-size: clamp(1.4rem, 4.5vw, 2rem); line-height: 1.2; font-weight: 650; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); align-items: start; gap: 8px; margin: 20px 0 12px; padding: 0; list-style: none; }
.meta li { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; box-shadow: var(--shadow); }
.meta b { display: block; font-size: .75rem; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); font-weight: 600; }
.result { font-size: 1.05rem; font-weight: 600; }
.result.ok { color: var(--ok); } .result.bad { color: var(--bad); }
.lanes { display: grid; gap: 8px; margin: 16px 0 28px; padding: 14px; list-style: none; background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); }
.lane { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 8px; }
.lane-name { display: inline-flex; align-items: center; gap: 8px; font-size: .88rem; font-weight: 600; }
.lane-steps { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.lanes a { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 44px; min-height: 36px; padding: 4px 10px; border-radius: 999px;
  border: 1px solid var(--line); background: var(--bg); color: var(--ink); text-decoration: none; font-size: .88rem; font-variant-numeric: tabular-nums; }
.lanes a:focus-visible, .shot a:focus-visible { outline: 2px solid var(--staff); outline-offset: 2px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.side-owner .dot, .badge.side-owner { background: var(--owner); } .side-staff .dot, .badge.side-staff { background: var(--staff); } .side-guest .dot, .badge.side-guest { background: var(--guest); }
.v { font-weight: 700; } .v-pass { color: var(--ok); } .v-fail { color: var(--bad); } .v-skip { color: var(--warn); } .v-not_run { color: var(--ink-2); }
ol.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.step { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px; box-shadow: var(--shadow); scroll-margin-top: 12px;
  display: grid; gap: 16px; grid-template-columns: 1fr; border-inline-start: 5px solid var(--line); }
.step.side-owner { border-inline-start-color: var(--owner); } .step.side-staff { border-inline-start-color: var(--staff); } .step.side-guest { border-inline-start-color: var(--guest); }
.step.is-fail { outline: 2px solid var(--bad); }
@media (min-width: 760px) { .step.frame-phone { grid-template-columns: minmax(0, 1fr) 260px; } .step.frame-phone .shot { order: 2; } }
.head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.num { font-variant-numeric: tabular-nums; color: var(--ink-2); font-weight: 600; }
.badge { color: #fff; font-size: .75rem; font-weight: 650; letter-spacing: .02em; padding: 2px 9px; border-radius: 999px; }
@media (prefers-color-scheme: dark) { .badge { color: #14110e; } }
h2 { margin: 0; font-size: 1.08rem; line-height: 1.35; font-weight: 640; flex: 1 1 220px; }
.caption { margin: 6px 0 0; unicode-bidi: plaintext; }
.reason { margin: 8px 0 0; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, var(--bad) 10%, transparent); color: var(--ink); }
.step.is-skip .reason { background: color-mix(in srgb, var(--warn) 12%, transparent); }
.times { margin: 8px 0 0; font-size: .85rem; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.shot { margin: 0; }
.shot a { display: block; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: var(--bg); }
.shot img { display: block; width: 100%; height: auto; }
.frame-phone .shot { max-width: 260px; }
.none { color: var(--ink-2); font-size: .9rem; }
footer { margin-top: 32px; color: var(--ink-2); font-size: .85rem; }
.lightbox { position: fixed; inset: 0; display: none; background: rgba(10, 8, 6, .86); padding: 16px; z-index: 5; align-items: center; justify-content: center; }
.lightbox:target { display: flex; }
.lightbox img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 10px; }
`;

/**
 * Writes the page and returns its path.
 * @param {import('./record.mjs').Walkthrough} w
 * @param {{ file: string, title: string, env: 'local' | 'demo', invented: boolean, about?: string }} o
 */
export function writePage(w, { file, title, env, invented, about = '' }) {
  const sum = w.summary();
  const img = (rel) => {
    try { return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(w.outDir, rel)).toString('base64'); } catch { return null; }
  };
  // the three sides as lanes: each side's steps in order, by number, with its verdict (the names are in the links' labels)
  const MARK = { pass: '✓', fail: '✗', skip: '–', not_run: '·' };
  const lanes = Object.entries(SIDES).map(([side, label]) => {
    const mine = w.steps.filter((s) => s.side === side);
    return `<li class="lane side-${side}"><span class="lane-name"><span class="dot" aria-hidden="true"></span>${label}</span><ol class="lane-steps">${mine.map((s) =>
      `<li><a href="#step-${s.n}" title="${esc(s.name)}" aria-label="Step ${s.n}: ${esc(s.name)}, ${VERDICT[s.verdict]}">${s.n}<span class="v v-${s.verdict}" aria-hidden="true">${MARK[s.verdict]}</span></a></li>`).join('')}</ol></li>`;
  }).join('');
  const steps = w.steps.map((s) => {
    const src = s.shot ? img(s.shot) : null;
    const shot = src
      ? `<figure class="shot"><a href="#big-${s.n}" aria-label="Screenshot of step ${s.n}, larger"><img src="${src}" alt="Screenshot: ${esc(s.name)}" loading="lazy"></a></figure>
         <div class="lightbox" id="big-${s.n}"><a href="#step-${s.n}" aria-label="Close"><img src="${src}" alt=""></a></div>`
      : '<p class="none">No screenshot.</p>';
    const times = s.startedAt
      ? `Started ${clock(s.startedAt)} · took ${secs(s.ms)}${s.waitedMs ? ` (${secs(s.waitedMs)} of it waiting for a mailbox or the authenticator's clock)` : ''} · budget ${secs(s.budgetMs)}`
      : `Budget ${secs(s.budgetMs)}`;
    return `<li class="step side-${s.side} frame-${s.frame ?? 'desk'} is-${s.verdict}" id="step-${s.n}">
      <div class="text">
        <div class="head"><span class="num">${s.n}</span><span class="badge side-${s.side}">${SIDES[s.side]}</span><h2>${esc(s.name)}</h2><span class="v v-${s.verdict}">${VERDICT[s.verdict]}</span></div>
        ${s.caption ? `<p class="caption" dir="auto">${esc(s.caption)}</p>` : ''}
        ${s.reason ? `<p class="reason" dir="auto">${esc(s.reason)}</p>` : ''}
        <p class="times">${times}</p>
      </div>
      ${s.verdict === 'not_run' ? '' : shot}
    </li>`;
  }).join('\n');
  const ok = sum.failed === 0 && sum.notRun === 0;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>${tokens()}${CSS}</style>
</head>
<body>
<main>
  <header class="top">${mark()}<div><p class="kicker">Mana · walkthrough · private</p><h1>${esc(title)}</h1></div></header>
  <ul class="meta">
    <li><b>Environment</b>${esc(ENV[env] ?? env)}</li>
    <li><b>When</b>${esc(day(w.startedAt))} (Israel)</li>
    <li><b>Menu</b>${invented ? 'Invented for this walkthrough (a stand-in, not a real menu)' : 'The owner’s own'}${about ? `<br><span class="none">${esc(about)}</span>` : ''}</li>
    <li><b>Result</b><span class="result ${ok ? 'ok' : 'bad'}">${sum.passed} of ${sum.total} steps passed</span><br>${sum.skipped ? `${sum.skipped} not available here · ` : ''}${sum.failed ? `${sum.failed} failed · ` : ''}${sum.notRun ? `${sum.notRun} not run · ` : ''}total ${secs(sum.ms)}</li>
  </ul>
  <nav aria-label="The steps, by side"><ul class="lanes">${lanes}</ul></nav>
  <ol class="steps">${steps}</ol>
  <footer>Written by the client walkthrough (e2e/walkthrough). Every step went through the apps in a browser as a person would (the owner and a guest on a 390 × 844 phone, Halom at a desk), except the extra guests the run calls bots. This page is private: it is never published.</footer>
</main>
</body>
</html>
`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  fs.writeFileSync(path.join(path.dirname(file), 'walkthrough.json'), JSON.stringify({ title, env, invented, ...w.toJSON() }, null, 2) + '\n');
  return file;
}
