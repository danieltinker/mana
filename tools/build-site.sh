#!/usr/bin/env bash
# Builds everything halom.io/mana serves into _site/. GitHub Actions runs it on every push to main
# (.github/workflows/pages.yml) and publishes _site/ to GitHub Pages; halom.io proxies /mana/ and /m/<name> to it.
#
#     bash tools/build-site.sh        # or: npm run build (at the root); then: npm run serve (http://127.0.0.1:4180/mana/)
#     MANA_ENV=demo bash tools/build-site.sh     # the same site with another environment's settings (docs/environments.md)
#     bash tools/build-site.sh --settings        # only says which settings a build would carry, and stops
#
# MANA_ENV picks the settings the site carries: production (the default, and all pages.yml ever builds: config.js),
# demo (config/demo.js: the Supabase project `mana`, schema 2; npm run demo) or local (config/local.js, written by
# npm run dev:local for the simulator's stack). Only production is published: under GitHub Actions any other is
# refused. A wrong MANA_ENV or a missing settings file stops the build before _site/ is touched.
#
# What goes where (the addresses are halom.io's):
#   brand/site/   → /mana/             the product page, photo guide, privacy, terms, their pictures, films and fonts
#   config.js     → /mana/config.js    the Supabase address, the publishable key, the short-link base, feature switches
#                                      (config/demo.js or config/local.js instead, for MANA_ENV=demo or local)
#   apps/view/    → /mana/view/, /m/<name>   the guest menu (built by esbuild into app.js and chunks/)
#   apps/studio/  → /mana/studio/      the owner app (built by Vite into apps/studio/dist/)
#   apps/ops/     → /mana/ops/         the back office (built by esbuild into apps/ops/dist/)
#   gen/          → /mana/gen/         the relief generator that runs in the owner's browser, with its models
#   stock/        → /mana/stock/       the placeholder picture library
# The served addresses did not change when the apps moved under apps/: _site/ keeps view/, studio/ and ops/ at its root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
OUT="$ROOT/_site"
MANA_ENV="${MANA_ENV:-production}"
case "$MANA_ENV" in
  production) CONFIG=config.js ;;
  demo)       CONFIG=config/demo.js ;;
  local)      CONFIG=config/local.js ;;
  *) echo "✗ MANA_ENV is \"$MANA_ENV\": production, demo or local"; exit 1 ;;
esac
if [ "${GITHUB_ACTIONS:-}" = true ] && [ "$MANA_ENV" != production ]; then echo "✗ GitHub Actions builds production only (MANA_ENV is $MANA_ENV)"; exit 1; fi
[ -s "$CONFIG" ] || { echo "✗ $CONFIG is missing (config/local.js: npm run dev:local writes it)"; exit 1; }
echo "· settings: $MANA_ENV ($CONFIG)"
[ "${1:-}" = --settings ] && exit 0
# One install for the three apps (an npm workspace): the root lock, package-lock.json, puts each app's packages in its
# own apps/<app>/node_modules at its own versions (typescript and pg, used by several workspaces, sit once at the
# root, same versions). It runs when an app has no node_modules yet.
deps() { for a in apps/view apps/studio apps/ops; do [ -d "$a/node_modules" ] || { npm ci --no-audit --no-fund --loglevel=error; return; }; done; }

deps
echo "· guest menu";  (cd apps/view && npm run -s build)
echo "· owner app";   (cd apps/studio && npm run -s check && npm run -s build)
echo "· back office"; (cd apps/ops && npm run -s build)

# remaster: the product page's scripts (brand/src/land → brand/site/land/, ignored by git); esbuild and three.js come from
# apps/view/node_modules, so this runs after the apps' deps are installed
echo "· product page"; node brand/tools/build-land.mjs
# /remaster
rm -rf "$OUT"; mkdir -p "$OUT"
cp -R brand/site/. "$OUT/"
cp "$CONFIG" "$OUT/config.js"
V=apps/view
mkdir -p "$OUT/view"
for f in index.html app.css app.js; do cp "$V/$f" "$OUT/view/$f"; done
for d in chunks demo fonts themes; do cp -R "$V/$d" "$OUT/view/$d"; done
cp -R "$V/looks" "$OUT/view/looks"      # night:templates: the looks gallery and its stills (/mana/view/looks/)
cp "$V/seat.js" "$OUT/view/seat.js"; cp -R "$V/seat" "$OUT/view/seat"      # night:seating  the seat map page (apps/view/seat/) and its entry
cp "$V/host.js" "$OUT/view/host.js"; cp -R "$V/host" "$OUT/view/host"      # timers  the host board (apps/view/host/: table clocks) and its entry
for f in floor.js floor-guest.js; do cp "$V/$f" "$OUT/view/$f"; done; cp -R "$V/floor" "$OUT/view/floor"      # lima  Café Lima's board and the guest's phone (apps/view/floor/)
cp -R apps/studio/dist "$OUT/studio"
cp -R apps/ops/dist "$OUT/ops"
mkdir -p "$OUT/gen"
for f in THIRD_PARTY_NOTICES.txt bridge.py gen.js manifest.js pipeline.py test.html worker.js; do cp "gen/$f" "$OUT/gen/$f"; done
cp -R gen/models gen/vendor "$OUT/gen/"
mkdir -p "$OUT/stock"
for f in NOTICE.md match.js stock.json; do cp "stock/$f" "$OUT/stock/$f"; done
cp -R stock/img "$OUT/stock/img"
: > "$OUT/.nojekyll"      # serve every file as it is (no Jekyll on GitHub Pages)

for p in index.html land/main.js config.js view/index.html view/app.js studio/index.html ops/index.html gen/gen.js stock/stock.json; do
  [ -s "$OUT/$p" ] || { echo "✗ _site/$p is missing"; exit 1; }
done
grep -q "'/mana/view/'" "$OUT/view/index.html" || { echo "✗ the guest menu's short-link base is not /mana/view/"; exit 1; }
# the settings are the environment's (production: halom-studio, untouched); a demo or local build names its own Supabase
# origin in the pages' Content-Security-Policy and nowhere names halom-studio (tools/site-env.mjs)
echo "· environment"; node tools/site-env.mjs "$OUT" "$MANA_ENV"
# night:gates — the _site checks, static (no browser, no network), so CI runs them too: the performance budgets
# (tools/check-budgets.mjs: the first dish's bytes, the page's scripts, media) and what the site may not contain or
# talk to (tools/check-site.mjs: source venue names, outside loads, secrets; gitleaks when it is on PATH).
echo "· the mark";    node brand/tools/sync-mark.mjs --check      # every copy of the mark matches brand/tools/mark.mjs
echo "· budgets";     node tools/check-budgets.mjs "$OUT"
echo "· site checks"; node tools/check-site.mjs "$OUT"
# /night:gates
echo "✓ _site: $(find "$OUT" -type f | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"
