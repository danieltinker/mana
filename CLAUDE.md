# Working on Mana

**Who decides.**
- Rami is CEO, product owner and product marketing for the restaurant venture. He decides what is built and in what
  order.
- Daniel is CTO. He decides how it is built, and approves code, pushes and deploys.

**This repository is public.**
- Never commit secrets, `.env` files, keys or tokens.
- `config.js` and `CONTRACT.md` hold Supabase's publishable key. It is public by design; `.gitleaksignore` names those
  lines. A secret key (`sb_secret_…`, `service_role`) must never appear anywhere.
- Never commit personal data, lead lists, client data or business documents. Business documents (brand, campaign,
  sales playbooks, overview) live in the Halom Project, under `ventures/mana/`.

**Changes reach people.**
- Commit or push only when asked.
- **A push to `main` is a release.** GitHub Actions builds the site and publishes it to halom.io/mana and every
  restaurant's menu. Push to `main` only on Daniel's explicit word; work on a branch until then.
- halom.io's routes are in the studio site repository (`danieltinker/halom`, `public/vercel.json`).
- halom.io is deployed only by Daniel, with `bash ~/Documents/halom/tools/deploy.sh`.

**The live backend is off limits.**
- Never write to the Supabase project `halom-studio`.
- Never call the live `menus-ai` with real scans.
- Test against the local stand-ins: `view` → `npm run serve`; `studio` → `npm run stack`; `ops` → `npm run serve`.
- Test credentials are for localhost only. Never repeat a credential's value in a reply.

**Words.**
- A dish is a "relief from one photo" (2.5D). Never call it a "3D model" or a "digital twin".
- Never invent results, numbers, quotes or prices.
- Demo food that was generated (Olea) is labelled as made with AI.
- Hebrew and French copy needs a native read before it goes out.

**Money.** No Higgsfield or other paid credits without Daniel's yes.

**Decisions are asked on the Halom To-Do page, as buttons.** The protocol is in the Project: `ops/inbox-protocol.md`.
