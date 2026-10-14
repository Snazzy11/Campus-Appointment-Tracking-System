# EC2 deployment workspace

This copy of pmingdemo defaults to local development. Run `./scripts/start-dev.sh` for the local API and Expo frontend. For local Docker, copy `deploy/local.env.example` to `deploy/local.env`, fill in your own credentials, and use `docker compose --env-file deploy/local.env`. Docker web defaults to http://localhost:18080. EC2 deployment is explicitly configured using `deploy/ec2.env`; see [the EC2 runbook](deploy/EC2.md).

# Campus Messaging — Expo + FastAPI + uv

An Expo SDK 57 app for iOS, Android, and web, backed by FastAPI, PostgreSQL, and AWS Cognito. It supports anonymous public chat, signed-in public messages, authenticated direct conversations, persisted latest-100 history, and live SSE delivery. This messaging prototype lives inside the Campus Appointment Tracking System repository; appointment scheduling integration is not implemented here.

## Documentation map

- [Frontend setup, native UI, authentication, and streaming](frontend/README.md)
- [Backend configuration, HTTP API, database model, and delivery](backend/README.md)
- [Database migrations](backend/migrations/README.md)
- [Development scripts and verification](scripts/README.md)
- [EAS builds and web/API deployment](deploy/README.md)

The previous Vite frontend is preserved under [frontend/legacy/vite](frontend/legacy/vite/README.md). `PHASE1.md`, `DEPLOYMENT.md`, and `REFACTOR_NOTES.md` are historical descriptions; the linked READMEs describe current behavior.

## Quick start for classmates

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and a current Node LTS/npm supported by Expo SDK 57 (Node 22.13+). Backend Python is pinned to 3.14 in `.python-version`; uv can provision it. A running PostgreSQL database and a configured Cognito public app client are required. The API does not create a database or login role.

```sh
# From pmingdemo/
cp backend/.env.example backend/.env       # only if no .env already exists
cp frontend/.env.example frontend/.env     # only if no .env already exists
# Edit backend/.env with your database and Cognito configuration.
cd backend
uv sync --locked
uv run --locked alembic upgrade head
cd ../frontend
npm ci
cd ..
./scripts/start-dev.sh    # local backend + public-chat preview in Expo Go
```

Keep existing `.env` files; the examples contain placeholders. Configure Cognito before sign-in as described below. FastAPI docs: http://localhost:8000/docs. Expo/Metro: port 8081; press `w` for web or scan the QR code in Expo Go for public chat. There is no Vite proxy. The app calls the absolute `EXPO_PUBLIC_API_URL`, defaulting to `http://localhost:8000`.

For a physical phone, set `frontend/.env` to your computer's reachable LAN address, for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000`, then run:

```sh
BACKEND_HOST=0.0.0.0 ./scripts/start-dev.sh --lan
```

The combined script defaults to backend host 127.0.0.1 and Expo Go on localhost. LAN access is explicit. For the installed native app with Cognito login, run `./scripts/start-dev.sh --dev-client`. Use the same reachable network for phone and computer. Android emulator uses `http://10.0.2.2:8000`; iOS simulator/web can use localhost. Reload Metro after changing environment values. An Expo tunnel only tunnels Metro, not FastAPI.

## Cognito and native builds

The app uses authorization code + PKCE, then sends the code/verifier to `/api/auth/session`. Web uses a same-tab Cognito redirect and validates its temporary tab-scoped pending transaction on callback; native uses Expo AuthSession. The backend verifies the Cognito ID token and returns an opaque eight-hour bearer session. Native sessions use Expo SecureStore; browser sessions stay in memory and require login after a full reload. Every authenticated request and private SSE connection sends Authorization; tokens never appear in stream URLs.

Register these callback URLs in the same Cognito app client and backend `COGNITO_APP_REDIRECT_URIS`:

- Native development/installed builds: `campusmessaging://auth/callback`
- Local web: `http://localhost:8081/auth/callback`
- Add a deployed HTTPS web callback explicitly when deploying.

The Cognito app client must have no client secret, support authorization-code grants, and permit `openid email profile`. The API exposes only its public domain/client ID at `/api/auth/config`.

Expo Go can preview public chat. Native Cognito login requires a development build with the app's `campusmessaging` scheme; the UI explains this if login is attempted in Expo Go. Build with `npx eas-cli@latest build --profile development --platform android` or `--platform ios` from frontend/, then run `npm start -- --dev-client`. EAS account/project configuration and real Cognito callback registration are external setup steps, not performed by this migration. See the [deployment README](deploy/README.md).

## Structure

```text
backend/
  pyproject.toml / uv.lock   Backend dependency source and reproducible resolution
  .python-version           uv Python selection
  app/main.py               FastAPI entry point
  app/routers/              Auth, public messaging, DMs, private stream
  app/models/               SQLAlchemy tables and relationships
  app/services/             DB/session dependencies, in-memory sessions, SSE queues
  migrations/               Alembic revisions
  tests/                    Isolated SQLite and mocked-Cognito tests
frontend/
  app.json / eas.json        Expo and development/preview/production build config
  src/app/                  Expo Router routes and root layout
  src/screens/              React Native messaging UI
  src/context/              Authentication provider
  src/components/           Cognito login button
  src/services/             API, secure session storage, SSE transport/parser
  tests/                    Chunked SSE parser tests
  legacy/vite/              Archived browser implementation
scripts/                    uv/Expo launchers and backend SSE smoke test
deploy/                     Nginx web/API example
```

No ios/ or android/ source directories are checked in; Expo generates them from configuration when needed. The local ios/ directory has now been generated for iPhone development and remains ignored. `backend/requirements.txt` is an export of the uv lock for compatibility, not the dependency source to edit.

## Persistence and scale

Users, conversations, memberships, and messages persist in PostgreSQL. Login sessions and SSE subscriptions live in a single backend process, so API restarts sign everyone out and multiple workers do not share auth/events. Browser drafts, selection, and per-chat caches are local state. History endpoints return the latest 100 messages; frontend caches retain at most 500 per chat without pagination.

Users can see their numeric database ID after signing in and enter another user's ID to start a DM. Membership checks guard private reads and writes; public data/stream exclude DMs. There are no search, read-receipt, edit/delete, group-management, moderation, or attachment endpoints.

## Checks

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

Migration verification: 12 backend tests, Ruff, frontend lint/typecheck, 12 frontend tests (SSE parser, web rendering, and OAuth callbacks), Expo Doctor (21/21), Android/iOS/web JS exports, and the live SSE smoke script against an isolated test backend. Exports are bundle checks, not signed native builds or device runtime tests. The local interactive Metro check hit a macOS watcher limit; see the frontend README for Watchman troubleshooting. PostgreSQL migrations and real Cognito login were not exercised against your accounts. Tests substitute an isolated SQLite database and mocked Cognito; they do not write to your configured database.

The tracked `backend/campus_messaging_before_dm.dump` was not inspected or restored. It is not required for fresh setup and must not be assumed to match the current schema.

## Automated updates

To redeploy updated local source to the existing EC2 app, run `./scripts/deploy-ec2.sh --dry-run`, then `./scripts/deploy-ec2.sh` from ec2demo. See [the redeployment guide](deploy/REDEPLOY.md) for setup, backups, migrations, and recovery.
