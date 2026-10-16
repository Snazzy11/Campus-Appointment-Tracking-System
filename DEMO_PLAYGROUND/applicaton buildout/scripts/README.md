# Local Expo + uv scripts

Run from `applicaton buildout/`. Each launcher resolves project paths from its own script directory.

| Script | Behavior |
| --- | --- |
| start-backend.sh | Requires uv, runs uv sync --locked, then uv run --locked uvicorn |
| start-frontend.sh | Requires npm; npm ci when node_modules is absent; starts Expo/Metro; forwards its command arguments |
| start-dev.sh | Defaults to backend 127.0.0.1 and Expo Go on localhost; checks uv/npm; forwards explicit Expo overrides; stops both when either child exits or on interrupt/termination |
| smoke-test.sh | Backend health/history + subscribe-before-post live SSE verification |

```sh
./scripts/start-dev.sh
# Installed development build with native Cognito login:
./scripts/start-dev.sh --dev-client
# Phone on your LAN (set frontend API URL to the Mac LAN IP):
BACKEND_HOST=0.0.0.0 ./scripts/start-dev.sh --dev-client --lan
# Separate terminals:
./scripts/start-backend.sh
./scripts/start-frontend.sh --web
```

The combined launcher defaults BACKEND_HOST to 127.0.0.1 and Expo to --go --localhost. Explicit BACKEND_HOST and Expo target/connection flags override those defaults. The standalone backend launcher defaults to 127.0.0.1. BACKEND_PORT defaults to 8000. Set frontend EXPO_PUBLIC_API_URL to the corresponding reachable address/port. Metro uses port 8081; it does not proxy requests. On physical devices localhost points at the device itself. An Expo tunnel does not expose the backend.

Install uv using [official instructions](https://docs.astral.sh/uv/getting-started/installation/). uv manages backend/.venv using the committed pyproject.toml/uv.lock/.python-version. Launchers do not configure accounts, create the database, or apply migrations. Run uv run --locked alembic upgrade head from backend/ after reviewing schema state. The combined launcher checks tool availability before starting either child, monitors both children, and stops the sibling when one exits. It does not perform an HTTP readiness check.

## Backend smoke check

With a configured backend already running:

```sh
./scripts/smoke-test.sh
# Optional backend URL override:
API_URL=http://127.0.0.1:8000 ./scripts/smoke-test.sh
```

This script writes one real public test message. It checks health and history, opens SSE first, waits for `: connected`, posts a uniquely named message, verifies live delivery, then confirms the message in persisted history. It cleans up its temporary file and curl process. The script no longer assumes SSE replay or a Vite proxy. It does not test authentication or DMs; health alone does not prove database connectivity.

## Tests

```sh
cd backend
uv run --locked pytest -q
uv run --locked ruff check app scripts tests
cd ../frontend
npm run lint
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform all
```

Backend tests use an isolated SQLite database and mocked Cognito, never the configured PostgreSQL database. They cover bearer/cookie precedence, logout/expiry, user provisioning, DM membership, private/public separation, pair reuse, PKCE request validation, redirect allowlisting, JWT checks, provider outages, CORS, and stream termination on overflow/expiry. SQLite tests do not validate PostgreSQL migrations or concurrency races.

## Manual native checks

1. Set a reachable API URL; open public chat on two clients and check live delivery/history.
2. Register app/web callback URIs and create a development build for native Cognito login.
3. Login with two distinct accounts. Ensure both Cognito emails are verified, then type three characters of the other's email and select the suggestion to create a DM.
4. Recreate the same pair from both sides and verify one conversation ID, private live delivery, and history after reopening.
5. Check that a third account receives 404 for private reads/writes and anonymous requests receive 401. Public history/stream must exclude DMs.
6. Background/foreground the app and interrupt network access; check history reload and reconnect.
7. Logout and verify private state/storage clears. Restart the API and verify stale bearer credentials are rejected; database messages should persist.
8. Inspect safe areas, keyboard avoidance, multiline composer, and long messages on actual iOS/Android devices.

## Automated updates

To redeploy updated local source to the existing EC2 app, run `./scripts/deploy-ec2.sh --dry-run`, then `./scripts/deploy-ec2.sh --migrate` from groupdemo for the first group-chat release. The script retains the existing cloud Compose project/database; subsequent code-only updates can omit `--migrate`. See [the redeployment guide](../deploy/REDEPLOY.md) for setup, backups, migrations, and recovery.

## Cloud updates

Run `./scripts/deploy-ec2.sh --dry-run` to inspect the target without connecting.
Run `./scripts/deploy-ec2.sh --migrate` for the current schema update, or omit
`--migrate` when no migrations are pending. Docker must be running on the Mac.
See [redeployment instructions](../deploy/REDEPLOY.md) for settings, backups,
rollback behavior, and the separate spatial database requirements.
