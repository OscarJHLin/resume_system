#!/usr/bin/env bash
# Prepare Tauri resources: web dist + templates (no developer data/; no Node server).
# Plan C Phase 4: desktop uses in-process Rust API — apps/server stays in monorepo for
# browser `npm run app` / acceptance / tests only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="$ROOT/apps/desktop/src-tauri/desktop-resources"
TEMPLATES_OUT="$OUT/templates"

echo "→ build domain / shared / web (desktop does not bundle Node server)"
npm run build -w @resume/domain -w @resume/shared -w @resume/web

rm -rf "$OUT"
mkdir -p "$TEMPLATES_OUT"

echo "→ copy templates → desktop-resources/templates"
cp -R "$ROOT/templates/." "$TEMPLATES_OUT/"

echo "→ desktop resources ready at $OUT (web-dist via tauri.conf frontendDist)"
ls "$TEMPLATES_OUT"
