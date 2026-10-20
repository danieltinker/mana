# Working on Mana

**Who decides.**
- Rami is CEO, product owner and product marketing for the restaurant venture. He decides what is built and in what
  order.
- Daniel is CTO. He decides how it is built, and approves code, pushes and deploys.

**This repository is public.**
- Never commit secrets, `.env` files, keys or tokens.
- `config.js`, `config/demo.js` and `CONTRACT.md` hold Supabase publishable keys. They are public by design;
  `.gitleaks.toml` allows a publishable key by its value, and nothing else. A secret key (`sb_secret_…`,
  `service_role`) must never appear anywhere.
- Never commit personal data, lead lists, client data or business documents. Business documents (brand, campaign,
  sales playbooks, overview) live in the Halom Project, under `ventures/mana/`.

**Changes reach people.**
- **Agents push feature branches and open pull requests; they never push to `main`** (Daniel, 15 Oct 2026). One task,
  one branch (`feat/<lane>-<topic>`), one PR, and the PR description is the report: what changed, the tests run and
  their results, screenshots of demo data only, open questions, risks. Run `gitleaks detect` on the branch before every
  push.
- **A merge to `main` is a release.** GitHub Actions builds the site and publishes it to halom.io/mana and every
  restaurant's menu. `main` is protected (pull request required, no force pushes), and every deploy waits for Daniel's
  approval on the `github-pages` environment. Agents never merge, enable auto-merge or approve a deployment.
- Never in a PR, commit or branch: terminal numbers, accountant answers, unpublished prices, real people's data, or a
  real venue's menu (the private demo seeds live outside git, in `private/`, which is ignored).
- halom.io's routes are in the studio site repository (`danieltinker/halom`, `public/vercel.json`).
- halom.io is deployed only by Daniel, with `bash ~/Documents/halom/tools/deploy.sh`.

**The live backend is off limits.**
- Never write to the Supabase project `halom-studio`.
- The Supabase project `mana` is the build and demo database until it serves real restaurants: agents may apply
  migrations and seed demo data there. From the day a real restaurant uses it, changes go back to proposed SQL that
  Daniel applies.
- Never call the live `menus-ai` with real scans.
- Test against the local stand-ins: `apps/view` → `npm run serve`; `apps/studio` → `npm run stack`; `apps/ops` → `npm run serve`.
- Test credentials are for localhost only. Never repeat a credential's value in a reply.

**Words.**
- A dish is a "relief from one photo" (2.5D). Never call it a "3D model" or a "digital twin".
- Never invent results, numbers, quotes or prices.
- Demo food that was generated (Olea) is labelled as made with AI.
- Hebrew and French copy needs a native read before it goes out.

**Money.** No Higgsfield or other paid credits without Daniel's yes.

**Decisions are asked on Mana HQ, as buttons.** The protocol is in the Project: `ops/inbox-protocol.md`. The plan is
`ventures/mana/command-2026-10-15.md`, with the feature map and the Hopa matrix beside it.
