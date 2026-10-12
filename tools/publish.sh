#!/usr/bin/env bash
# Publish Mana. Builds the parts you name and copies them into the `pages` branch, which GitHub Pages serves and
# halom.io proxies (halom.io/mana/… and halom.io/m/<name>). Run it from a clean `main`:
#
#     bash tools/publish.sh                 # view, studio, ops and site
#     bash tools/publish.sh view studio     # only these
#
#   view    the guest menu's code: view/index.html, app.css, app.js, chunks/ (its fonts, textures and demo pictures stay)
#   studio  the owner app: studio/dist/ replaces pages:studio/
#   ops     the back office: ops/dist/ replaces pages:ops/
#   site    the product page, guide, privacy and terms from brand/site/ (the films and posters on pages stay)
#
# It never deletes media on `pages`, never touches pages:config.js, shows what changed, and pushes only on "y".
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
PARTS=("$@"); [ ${#PARTS[@]} -gt 0 ] || PARTS=(view studio ops site)
for p in "${PARTS[@]}"; do case "$p" in view|studio|ops|site) ;; *) echo "✗ unknown part: $p (view, studio, ops, site)"; exit 1;; esac; done
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "✗ check out main first"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "✗ main has uncommitted changes; commit or set them aside first"; git status --short; exit 1; }

git fetch -q origin pages
W="$ROOT/.pages"
if git -C "$W" rev-parse --git-dir >/dev/null 2>&1; then git -C "$W" checkout -q --detach origin/pages && git -C "$W" reset -q --hard origin/pages && git -C "$W" clean -qfd
else rm -rf "$W"; git worktree prune; git worktree add -q --detach "$W" origin/pages; fi
[ -f "$W/view/index.html" ] && [ -f "$W/config.js" ] || { echo "✗ $W does not look like the pages branch; nothing was changed"; exit 1; }

deps() { [ -d "$1/node_modules" ] || (cd "$1" && npm ci --no-audit --no-fund --silent); }
for p in "${PARTS[@]}"; do
  echo "· $p"
  case "$p" in
    view)   deps view; (cd view && npm run -s build)
            for f in index.html app.css app.js; do cp "view/$f" "$W/view/$f"; done
            rm -rf "$W/view/chunks"; cp -R view/chunks "$W/view/chunks" ;;
    studio) deps studio; (cd studio && npm run -s check && npm run -s build)
            rm -rf "$W/studio"; cp -R studio/dist "$W/studio" ;;
    ops)    deps ops; (cd ops && npm run -s build)
            rm -rf "$W/ops"; cp -R ops/dist "$W/ops" ;;
    site)   cp -R brand/site/. "$W/" ;;
  esac
done

if [ -n "$(git status --porcelain)" ]; then
  echo; echo "! The build changed files on main (usually view/app.js and view/chunks/). Commit them on main too:"; git status --short
fi

cd "$W"; git add -A
if git diff --cached --quiet; then echo; echo "Nothing to publish: pages already has this."; exit 0; fi
echo; git status --short | head -60; git diff --cached --shortstat; echo
read -r -p "Publish ${PARTS[*]} to halom.io/mana now (push to pages)? [y/N] " a
if [ "$a" = y ]; then
  git commit -q -m "Publish ${PARTS[*]} from main $(git -C "$ROOT" rev-parse --short HEAD)"
  git push origin HEAD:pages
  echo "✓ pushed. GitHub Pages updates in a minute or two; halom.io needs no deploy."
else
  git reset -q --hard; echo "Skipped. Nothing was pushed."
fi
