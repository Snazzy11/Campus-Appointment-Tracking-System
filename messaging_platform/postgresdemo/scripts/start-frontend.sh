#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/../frontend"
if ! command -v npm >/dev/null 2>&1; then echo "Error: npm is not installed." >&2; exit 1; fi
if [[ ! -d node_modules ]]; then echo "Installing frontend dependencies..."; npm ci; fi
exec npm run dev
