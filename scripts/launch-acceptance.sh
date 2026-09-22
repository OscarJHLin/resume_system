#!/usr/bin/env bash
# One-command acceptance launcher: build web (optional), serve API+SPA, open browser.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-8787}"
HOST="${HOST:-127.0.0.1}"
DATA_DIR="${RESUME_DATA_DIR:-$ROOT/data}"
mkdir -p "$DATA_DIR"
export RESUME_DB_PATH="${RESUME_DB_PATH:-$DATA_DIR/resume.db}"
export PORT HOST

if [[ "${SKIP_WEB_BUILD:-0}" != "1" ]]; then
  echo "→ building web…"
  npm run build -w @resume/web
fi

export RESUME_STATIC_DIR="$ROOT/apps/web/dist"
if [[ ! -f "$RESUME_STATIC_DIR/index.html" ]]; then
  echo "missing $RESUME_STATIC_DIR/index.html — run web build" >&2
  exit 1
fi

echo "→ starting server on http://$HOST:$PORT"
echo "   db=$RESUME_DB_PATH"
echo "   static=$RESUME_STATIC_DIR"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

npm run start -w @resume/server &
SERVER_PID=$!

# wait for health
for _ in $(seq 1 40); do
  if curl -sf "http://$HOST:$PORT/health" >/dev/null; then
    break
  fi
  sleep 0.25
done

if ! curl -sf "http://$HOST:$PORT/health" >/dev/null; then
  echo "server failed to become healthy" >&2
  exit 1
fi

URL="http://$HOST:$PORT/"
echo "→ open $URL"
if command -v open >/dev/null; then
  open "$URL"
elif command -v xdg-open >/dev/null; then
  xdg-open "$URL"
fi

echo "Acceptance app running. Ctrl+C to stop."
echo "Checklist: docs/05-acceptance.md"
wait "$SERVER_PID"
