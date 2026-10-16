#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 - "$ROOT" <<'PYCODE'
import os, signal, subprocess, sys, time
root = sys.argv[1]
children = []
def stop(signum=None, frame=None):
    for child in children:
        try: os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError: pass
    for child in children:
        try: child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
    sys.exit(0)
signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    for name in ('start-backend.sh', 'start-frontend.sh'):
        children.append(subprocess.Popen([os.path.join(root, name)], start_new_session=True))
    print('Backend: http://127.0.0.1:8000 | Frontend: http://localhost:5173', flush=True)
    while all(child.poll() is None for child in children):
        time.sleep(0.3)
finally:
    stop()
PYCODE
