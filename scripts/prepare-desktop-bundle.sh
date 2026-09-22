#!/usr/bin/env bash
# Prepare Tauri resources: bundled server.mjs + templates (no developer data/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="$ROOT/apps/desktop/src-tauri/desktop-resources"
SERVER_OUT="$OUT/server"
TEMPLATES_OUT="$OUT/templates"

echo "→ build domain / shared / server / web"
npm run build -w @resume/domain -w @resume/shared -w @resume/server -w @resume/web

rm -rf "$OUT"
mkdir -p "$SERVER_OUT" "$TEMPLATES_OUT"

echo "→ esbuild Fastify server → desktop-resources/server/server.mjs"
npx --yes esbuild@0.25.9 \
  "$ROOT/apps/server/src/index.ts" \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node22 \
  --outfile="$SERVER_OUT/server.mjs" \
  --packages=bundle \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"

# Ensure direct-run guard still fires for server.mjs
# (isDirectRun checks argv ends with index.js / index.ts — also allow server.mjs)
# Patch is already in source after we update index.ts

echo "→ copy templates"
cp -R "$ROOT/templates/." "$TEMPLATES_OUT/"

# Marker so the shell can detect a packaged layout
cat > "$SERVER_OUT/README.txt" <<'EOF'
拼履 bundled API server (Node 22+).
Spawned by the Tauri shell with RESUME_DB_PATH in the OS app-data directory.
EOF

echo "→ desktop resources ready at $OUT"
ls -la "$SERVER_OUT"
ls "$TEMPLATES_OUT"
