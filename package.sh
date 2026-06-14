#!/usr/bin/env bash
# Builds a Chrome Web Store-ready .zip with manifest.json at the root and
# nothing but the files the extension actually needs to run.
set -euo pipefail
cd "$(dirname "$0")"

VERSION="$(node -p "require('./manifest.json').version")"
OUT="docs-dark-mode-v${VERSION}.zip"

# Regenerate icons so the package is always up to date.
node tools/make-icons.mjs

rm -f "$OUT"
zip -r -q "$OUT" \
  manifest.json \
  content \
  popup \
  icons \
  -x '*.DS_Store' '*/.*'

echo "Built $OUT:"
unzip -l "$OUT"
