#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/../backend"
if [[ -x "$ROOT/backend/.venv/bin/python" ]]; then
  PYTHON="$ROOT/backend/.venv/bin/python"
elif [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  echo "Creating backend virtual environment..."
  python3 -m venv "$ROOT/backend/.venv"
  PYTHON="$ROOT/backend/.venv/bin/python"
fi
if ! "$PYTHON" -c 'import fastapi, uvicorn' >/dev/null 2>&1; then
  echo "Installing backend dependencies..."
  "$PYTHON" -m pip install -r requirements.txt
fi
exec "$PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
