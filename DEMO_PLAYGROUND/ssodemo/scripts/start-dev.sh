
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Campus Messaging development servers..."

# Start FastAPI in the background.
"$SCRIPT_DIR/start-backend.sh" &
BACKEND_PID=$!

# Start Vite in the background.
"$SCRIPT_DIR/start-frontend.sh" &
FRONTEND_PID=$!

cleanup() {
    trap - EXIT INT TERM

    echo "Stopping development servers..."

    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Backend:  http://127.0.0.1:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both servers."

# Stop the launcher if either service exits.
wait "$BACKEND_PID" "$FRONTEND_PID"