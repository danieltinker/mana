#!/usr/bin/env bash
# Builds everything halom.io/mana serves into _site/. GitHub Actions runs it on every push to main
# (.github/workflows/pages.yml) and publishes _site/ to GitHub Pages; halom.io proxies /mana/ and /m/<name> to it.
#
#     bash tools/build-site.sh        # then: npx serve _site, or look at _site/ directly
#
# What goes where (the addresses are halom.io's):
#   brand/site/  → /mana/             the product page, photo guide, privacy, terms, their pictures, films and fonts
#   config.js    → /mana/config.js    the Supabase address, the publishable key, the short-link base, feature switches
#   view/        → /mana/view/, /m/<name>   the guest menu (built by esbuild into app.js and chunks/)
#   studio/      → /mana/studio/      the owner app (built by Vite into studio/dist/)
#   ops/         → /mana/ops/         the back office (built by esbuild into ops/dist/)
#   gen/         → /mana/gen/         the relief generator that runs in the owner's browser, with its models
#   stock/       → /mana/stock/       the placeholder picture library
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
OUT="$ROOT/_site"
deps() { [ -d "$1/node_modules" ] || (cd "$1" && npm ci --no-audit --no-fund --loglevel=error); }

echo "· guest menu";  deps view;   (cd view && npm run -s build)
echo "· owner app";   deps studio; (cd studio && npm run -s check && npm run -s build)
echo "· back office"; deps ops;    (cd ops && npm run -s build)

# remaster: the product page's scripts (brand/src/land → brand/site/land/, ignored by git); esbuild and three.js come from
# view/node_modules, so this runs after the guest menu's deps are installed
echo "· product page"; node brand/tools/build-land.mjs
# /remaster
rm -rf "$OUT"; mkdir -p "$OUT"
cp -R brand/site/. "$OUT/"
cp config.js "$OUT/config.js"
mkdir -p "$OUT/view"
for f in index.html app.css app.js; do cp "view/$f" "$OUT/view/$f"; done
for d in chunks demo fonts themes; do cp -R "view/$d" "$OUT/view/$d"; done
cp -R view/looks "$OUT/view/looks"      # night:templates: the looks gallery and its stills (/mana/view/looks/)
cp "view/seat.js" "$OUT/view/seat.js"; cp -R "view/seat" "$OUT/view/seat"      # night:seating  the seat map page (view/seat/) and its entry
cp "view/host.js" "$OUT/view/host.js"; cp -R "view/host" "$OUT/view/host"      # timers  the host board (view/host/: table clocks) and its entry
for f in floor.js floor-guest.js; do cp "view/$f" "$OUT/view/$f"; done; cp -R "view/floor" "$OUT/view/floor"      # lima  Café Lima's board and the guest's phone (view/floor/)
cp -R studio/dist "$OUT/studio"
cp -R ops/dist "$OUT/ops"
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
# night:gates — the _site checks, static (no browser, no network), so CI runs them too: the performance budgets
# (tools/check-budgets.mjs: the first dish's bytes, the page's scripts, media) and what the site may not contain or
# talk to (tools/check-site.mjs: source venue names, outside loads, secrets; gitleaks when it is on PATH).
echo "· budgets";     node tools/check-budgets.mjs "$OUT"
echo "· site checks"; node tools/check-site.mjs "$OUT"
# /night:gates
echo "✓ _site: $(find "$OUT" -type f | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"
