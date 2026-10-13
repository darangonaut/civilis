#!/usr/bin/env bash
# Zostaví hru a nahrá ju do vetvy gh-pages (GitHub Pages: https://darangonaut.github.io/civilis/).
set -euo pipefail
cd "$(dirname "$0")/.."

remote="$(git remote get-url origin)"
email="$(git config user.email)"
name="$(git config user.name)"
revision="$(git rev-parse --short HEAD)"

npm run build
cd dist
touch .nojekyll # GitHub Pages nemá spracovať súbory cez Jekyll
git init -q -b gh-pages
git add -A
git -c user.email="$email" -c user.name="$name" commit -q -m "Nasadenie $revision"
git push -q -f "$remote" gh-pages
rm -rf .git
echo "Nasadené: $revision"
