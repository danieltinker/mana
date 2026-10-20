/* The client walkthrough on an invented café (D38; the synthetic twin of a client's private walkthrough): every step of
   phase 1's acceptance test on all three sides, through the real apps in Chromium, written to one walkthrough page.

     npm run demo -- --scenario client-walkthrough          on the demo database `mana` (Daniel's Mac; accounts below)
     npm run dev:local -- --scenario client-walkthrough     on the simulator's stack (Linux x64)
     cd e2e && node --test walkthrough.test.mjs             the same, twice, as a test (writes e2e/.out/walkthrough/)

   The café ("Pina Sim Café") and its Wolt text are invented (e2e/fixtures/walkthrough-cafe.mjs). On demo the run needs
   private/demo.env (git-ignored, never printed): MANA_DEMO_STAFF_EMAIL and MANA_DEMO_STAFF_PASSWORD (a Halom admin), and
   MANA_DEMO_OWNER_EMAIL, a template with {run} for a fresh owner per run. docs/demo-walkthrough.md has the rest. */
import path from 'node:path';
import { PINA_SIM } from '../../e2e/fixtures/walkthrough-cafe.mjs';
import { demoAccounts } from '../../e2e/walkthrough/accounts.mjs';
import { newRunId, runWalkthrough } from '../../e2e/walkthrough/scenario.mjs';

/** The walkthrough itself, for a test or a script: its result (summary, steps, the page's path, the venue). */
export async function walkthrough({ config, origin, root, outDir, log = () => {}, stack = null, runId = newRunId() }) {
  return runWalkthrough({
    input: PINA_SIM, config, origin, outDir, log, stack, runId,
    accounts: demoAccounts({ root, env: config.env, runId }),
    title: 'Client walkthrough: Pina Sim Café (invented)',
  });
}

/** The demo's seam (tools/demo.mjs): run it, say where the page is, and offer the venue's guest menu. */
export async function run({ config, origin, root, outDir, log, stack = null }) {
  const r = await walkthrough({ config, origin, root, outDir, log, stack });
  log(`  the walkthrough page: ${path.relative(root, r.file)}`);
  if (!r.ok) process.exitCode = 1;                       // the demo keeps serving; dev:local --exit says it failed
  return { links: [['the walkthrough venue (guests)', `/m/${r.slug}`]] };
}
