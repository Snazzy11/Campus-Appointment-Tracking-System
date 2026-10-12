#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Local development defaults; explicit environment values and Expo flags still win.
export BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
HAS_TARGET=false
HAS_CONNECTION=false
for arg in "$@"; do
    case "$arg" in
        --go|--dev-client) HAS_TARGET=true ;;
        --lan|--localhost|--tunnel|--host|--host=*) HAS_CONNECTION=true ;;
    esac
done
if [[ "$HAS_TARGET" == false ]]; then set -- --go "$@"; fi
if [[ "$HAS_CONNECTION" == false ]]; then set -- --localhost "$@"; fi

# Validate both tools before starting either service.
if ! command -v uv >/dev/null 2>&1; then
    echo "Error: uv is required to start the backend. Install it from https://docs.astral.sh/uv/getting-started/installation/" >&2
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is required to start Expo." >&2
    exit 1
fi

echo "Starting Campus Messaging development servers..."

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    trap - EXIT INT TERM

    echo "Stopping development servers..."

    if [[ -n "$BACKEND_PID" ]]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    if [[ -n "$FRONTEND_PID" ]]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    wait 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$SCRIPT_DIR/start-backend.sh" &
BACKEND_PID=$!

"$SCRIPT_DIR/start-frontend.sh" "$@" &
FRONTEND_PID=$!

echo "Backend:  port ${BACKEND_PORT:-8000}, host ${BACKEND_HOST:-127.0.0.1}"
echo "Expo:     http://localhost:8081 (Metro QR code for devices)"
echo "Press Ctrl+C to stop both servers."

# Portable to macOS Bash 3: stop the other service as soon as one child exits.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
    sleep 1
done
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    EXITED_PID="$BACKEND_PID"
    EXITED_SERVICE="Backend"
else
    EXITED_PID="$FRONTEND_PID"
    EXITED_SERVICE="Expo"
fi
if wait "$EXITED_PID"; then
    EXIT_STATUS=0
else
    EXIT_STATUS=$?
fi
echo "$EXITED_SERVICE stopped (exit $EXIT_STATUS); stopping the other service." >&2
exit "$EXIT_STATUS"
