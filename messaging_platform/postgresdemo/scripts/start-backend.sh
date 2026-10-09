
#!/usr/bin/env bash
set -euo pipefail

# Directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Actual backend directory
BACKEND_DIR="$SCRIPT_DIR/../backend"

cd "$BACKEND_DIR"

# Always use the backend's own virtual environment
VENV_DIR="$BACKEND_DIR/.venv"
PYTHON="$VENV_DIR/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Creating backend virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

echo "Installing/verifying backend dependencies..."
"$PYTHON" -m pip install -r requirements.txt

echo "Starting FastAPI..."
exec "$PYTHON" -m uvicorn app.main:app \
  --reload \
  --host 127.0.0.1 \
  --port 8000
