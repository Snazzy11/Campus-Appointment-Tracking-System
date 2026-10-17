#!/usr/bin/env bash
set -euo pipefail
# Run ./start-dev.sh in another terminal first.
BACKEND="http://127.0.0.1:8000"
FRONTEND="http://127.0.0.1:5173"
echo "1/4 Checking FastAPI health..."
curl --fail --silent --show-error "$BACKEND/api/health" | grep -q '"status":"ok"'
echo "2/4 Checking Vite proxy..."
curl --fail --silent --show-error "$FRONTEND/api/health" | grep -q '"status":"ok"'
echo "3/4 Checking message POST..."
TOKEN="phase1-smoke-$(date +%s)-$$"
curl --fail --silent --show-error -X POST "$FRONTEND/api/data" \
  -H 'Content-Type: application/json' \
  --data "{\"text\":\"$TOKEN\"}" >/dev/null
echo "4/4 Checking SSE replay via Vite proxy..."
# SSE streams stay open; curl exits after a few seconds. Look for our message in its replay.
OUTPUT="$(curl --no-buffer --silent --show-error --max-time 3 "$FRONTEND/api/stream" 2>/dev/null || true)"
if ! printf '%s' "$OUTPUT" | grep -Fq "$TOKEN"; then
  echo 'FAIL: Message was not received via SSE stream' >&2
  exit 1
fi
echo 'PASS: FastAPI, Vite proxy, message POST, and SSE all work.'
