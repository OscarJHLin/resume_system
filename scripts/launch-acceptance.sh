#!/usr/bin/env bash
# One-command acceptance launcher: build web (optional), serve API+SPA, open browser.
# Server is started with nohup so it survives launcher exit / failed `open`
# (previously trap EXIT killed the API after export or when the parent shell ended).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-8787}"
HOST="${HOST:-127.0.0.1}"
DATA_DIR="${RESUME_DATA_DIR:-$ROOT/data}"
LOG_FILE="${RESUME_SERVER_LOG:-$ROOT/data/server.log}"
PID_FILE="${RESUME_SERVER_PID:-$ROOT/data/server.pid}"
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

# Stop previous instance if still bound
if curl -sf "http://$HOST:$PORT/health" >/dev/null 2>&1; then
  if [[ -f "$PID_FILE" ]]; then
    old="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      echo "→ stopping previous server pid=$old"
      kill "$old" 2>/dev/null || true
      sleep 0.5
    fi
  fi
  # If something else holds the port, leave a note (do not kill unknown PIDs aggressively)
fi

echo "→ starting server on http://$HOST:$PORT"
echo "   db=$RESUME_DB_PATH"
echo "   static=$RESUME_STATIC_DIR"
echo "   log=$LOG_FILE"

# Durable child: ignore SIGHUP when launcher/agent shell exits
nohup npm run start -w @resume/server >>"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

cleanup_on_signal() {
  echo "→ stopping server pid=$SERVER_PID"
  kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  exit 0
}
# Only Ctrl+C / kill — NOT EXIT (EXIT used to kill the server after `open` failed
# or when a background launcher shell ended, which looked like “export crashed the API”).
trap cleanup_on_signal INT TERM

# wait for health
ok=0
for _ in $(seq 1 40); do
  if curl -sf "http://$HOST:$PORT/health" >/dev/null; then
    ok=1
    break
  fi
  # bail early if process already dead
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "server process exited early — see $LOG_FILE" >&2
    tail -40 "$LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 0.25
done

if [[ "$ok" != "1" ]]; then
  echo "server failed to become healthy — see $LOG_FILE" >&2
  tail -40 "$LOG_FILE" >&2 || true
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

URL="http://$HOST:$PORT/"
echo "→ open $URL"
if command -v open >/dev/null; then
  open "$URL" || true
elif command -v xdg-open >/dev/null; then
  xdg-open "$URL" || true
fi

echo "Acceptance app running (pid=$SERVER_PID). Ctrl+C to stop."
echo "Checklist: docs/05-acceptance.md"
echo "Log: $LOG_FILE"

# Foreground wait only when interactive; otherwise detach and leave server up
if [[ -t 0 ]]; then
  wait "$SERVER_PID" || true
  rm -f "$PID_FILE"
else
  # Agent / background: do not wait — keep API alive after this script exits
  disown "$SERVER_PID" 2>/dev/null || true
  trap - INT TERM
  echo "Detached. Stop later with: kill \$(cat $PID_FILE)"
fi
