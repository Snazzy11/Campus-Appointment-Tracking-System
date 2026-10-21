#!/usr/bin/env bash
set -euo pipefail
# Backend-only check: Expo calls an absolute API URL; there is no Vite proxy.
BACKEND="${API_URL:-http://127.0.0.1:8000}"
STREAM_FILE="$(mktemp)"
STREAM_PID=""
cleanup() {
  if [[ -n "$STREAM_PID" ]]; then kill "$STREAM_PID" 2>/dev/null || true; wait "$STREAM_PID" 2>/dev/null || true; fi
  rm -f "$STREAM_FILE"
}
trap cleanup EXIT
curl --fail --silent --show-error "$BACKEND/api/health" | grep -q '"status":"ok"'
curl --fail --silent --show-error "$BACKEND/api/data" >/dev/null
# Subscribe before posting: this stream has no history replay.
curl --fail --no-buffer --silent --show-error --max-time 15 "$BACKEND/api/stream" >"$STREAM_FILE" 2>/dev/null &
STREAM_PID=$!
READY=false
for _ in {1..50}; do
  if grep -q ': connected' "$STREAM_FILE"; then READY=true; break; fi
  if ! kill -0 "$STREAM_PID" 2>/dev/null; then break; fi
  sleep 0.1
done
if [[ "$READY" != true ]]; then echo 'FAIL: stream did not connect' >&2; exit 1; fi
TOKEN="expo-smoke-$(date +%s)-$$"
curl --fail --silent --show-error "$BACKEND/api/data" -H 'Content-Type: application/json' --data "{\"text\":\"$TOKEN\"}" >/dev/null
for _ in {1..50}; do
  if grep -Fq "$TOKEN" "$STREAM_FILE"; then
    curl --fail --silent --show-error "$BACKEND/api/data" | grep -Fq "$TOKEN"
    echo 'PASS: backend health, persisted public history, and live SSE delivery.'
    exit 0
  fi
  sleep 0.1
done
echo 'FAIL: live SSE message was not received' >&2
exit 1
