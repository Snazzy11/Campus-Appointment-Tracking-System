#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../backend"
if ! command -v uv >/dev/null 2>&1; then
  echo "Error: uv is required. Install it from https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 1
fi
uv sync --locked
# Use BACKEND_HOST=0.0.0.0 for devices on your local network.
exec uv run --locked uvicorn app.main:app --host "${BACKEND_HOST:-127.0.0.1}" --port "${BACKEND_PORT:-8000}"
