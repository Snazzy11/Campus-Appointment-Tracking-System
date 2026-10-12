#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../frontend"
if ! command -v npm >/dev/null 2>&1; then echo "Error: npm is required." >&2; exit 1; fi
if [[ ! -d node_modules ]]; then npm ci; fi
exec npm run start -- "$@"
