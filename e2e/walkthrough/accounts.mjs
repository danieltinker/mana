// The accounts a walkthrough on the demo database needs, read from private files (git-ignored) and never printed:
// - private/demo.env: Halom's admin (MANA_DEMO_STAFF_EMAIL, MANA_DEMO_STAFF_PASSWORD; MANA_DEMO_STAFF_TOTP_SECRET, the
//   base32 secret of the account's TOTP factor, when the database asks staff for a second step) and, for a scenario
//   that names no owner address of its own, MANA_DEMO_OWNER_EMAIL;
// - the owner's address is a template with {run} (a fresh address per run, under a domain Halom controls or a
//   plus-address of Halom's mailbox): halom.studio+demo-{run}@gmail.com.
// What is missing is listed by the step that needs it; the walkthrough stops before anything is written.
import fs from 'node:fs';
import path from 'node:path';
import { fillRun } from './scenario.mjs';
import { base32Decode } from './totp.mjs';

export const DEMO_ENV = 'private/demo.env';

/** KEY=value lines (# comments, blank lines, optional quotes). Nothing is logged. */
export function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/**
 * The demo accounts for one run, with `problems` naming what is missing and which step needs it (none on local, where
 * the walkthrough makes its own).
 * @param {{ root: string, env: string, runId: string, ownerTemplate?: string | null, ownerSource?: string }} o
 *   ownerTemplate  the scenario's own owner address (a private settings file), else MANA_DEMO_OWNER_EMAIL
 *   ownerSource    where to say it goes when it is missing
 */
export function demoAccounts({ root, env, runId, ownerTemplate = null, ownerSource = `MANA_DEMO_OWNER_EMAIL in ${DEMO_ENV}` }) {
  if (env !== 'demo') return {};
  const vars = readEnvFile(path.join(root, DEMO_ENV));
  const problems = [];
  const template = ownerTemplate || vars.MANA_DEMO_OWNER_EMAIL || '';
  if (!template) problems.push(`step 1 (the owner signs up) needs a fresh demo address: set ${ownerSource} (for example halom.studio+demo-{run}@gmail.com; {run} becomes this run's id)`);
  else if (!template.includes('{run}')) problems.push(`step 1 (the owner signs up): the owner address in ${ownerSource} needs {run}, so every run signs up a fresh account`);
  if (!vars.MANA_DEMO_STAFF_EMAIL || !vars.MANA_DEMO_STAFF_PASSWORD) {
    problems.push(`steps 10, 15 and 16 (Halom approves, observes, acts for the owner) need a Halom admin's sign-in: set MANA_DEMO_STAFF_EMAIL and MANA_DEMO_STAFF_PASSWORD in ${DEMO_ENV}`);
  }
  const totp = vars.MANA_DEMO_STAFF_TOTP_SECRET || null;
  if (totp) { try { if (!base32Decode(totp).length) throw new Error('empty'); } catch { problems.push(`MANA_DEMO_STAFF_TOTP_SECRET is not a base32 secret (in ${DEMO_ENV})`); } }
  return {
    owner: template.includes('{run}') ? { email: fillRun(template, runId) } : undefined,
    staff: vars.MANA_DEMO_STAFF_EMAIL && vars.MANA_DEMO_STAFF_PASSWORD
      ? { email: vars.MANA_DEMO_STAFF_EMAIL, password: vars.MANA_DEMO_STAFF_PASSWORD, ...(totp ? { totp } : {}) } : undefined,
    problems,
  };
}
