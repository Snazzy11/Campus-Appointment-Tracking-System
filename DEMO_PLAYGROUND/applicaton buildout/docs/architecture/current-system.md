# Current system audit — 2026-10-13

## Scope and inventory

Repository: `/Users/carter/c/sd/Campus-Appointment-Tracking-System`. Active application: `messaging_platform/applicaton buildout`. Siblings pmingdemo, ec2demo and groupdemo are historical development baselines, not mapping implementation targets. Existing uncommitted changes from profile/logout/UI work remain intact.

| Concern | Current implementation |
| --- | --- |
| Frontend | Expo ~57.0.28, React 19.2.3, React Native 0.86.3, react-native-web 0.21.2; npm/package-lock.json; Stage 1 adds pinned MapLibre GL JS 6.14.0 and native 11.5.0 |
| Entry/routing | expo-router/entry; src/app/_layout.tsx auth provider; (tabs)/_layout.tsx Schedule, Maps, Messaging, RSO; auth/callback and profile |
| Maps | (tabs)/maps.tsx uses PlaceholderScreen; no map/geolocation/GIS dependency or data model at audit baseline; Stage 1 now supplies flag-controlled MapLibre renderers (see geospatial/stage-1.md) |
| Backend | Python 3.14, uv/uv.lock, FastAPI app.main:app; synchronous SQLAlchemy/psycopg request sessions; Alembic |
| Authentication | Cognito authorization code + PKCE, RS256 verified ID tokens, exact callback allowlist; opaque eight-hour bearer sessions in process memory; SecureStore on native, memory-only web token |
| Permissions | Authenticated identity and conversation membership; group owners table; no administrator/moderator role yet |
| Data | users, messages, conversations, conversation_members, conversation_owners; profiles and avatar references on users |
| Real time | Public and user-scoped private SSE; bounded process-local queues, session/membership rechecks; reconnect reloads persisted histories |
| Photo storage | Explicit persistent disk directory/Compose avatar volume or private S3; normalized JPEG, bounded uploads |
| Native | iOS/Android Expo targets and EAS profiles; ignored/generated native projects absent in this folder; an earlier sibling build is not proof of this source's device behavior |
| Web/PWA | Static Expo web export with clean-route Nginx fallback; no active service worker/offline PWA implementation identified; archived Vite is inactive |
| Local | campus-buildout Compose; PostgreSQL campus_buildout exposed only on 127.0.0.1:5434; uv API 8000; Expo 8081 |
| Cloud | ARM64 Ubuntu EC2, host Nginx, isolated campus-ec2demo stack at /home/ubuntu/apps/ec2demo; prebuilt ARM images uploaded via SSH; messaging.tufts.pro |
| CI/tests | 51 pytest tests (SQLite/mocked Cognito), 25 Node frontend tests, eight deployment tests; no repository .github workflow or existing browser E2E suite found |

## Database inspection

Read-only connection confirms PostgreSQL 17.11 on aarch64; Alembic head d8b4a21e653c. pg_available_extensions has no rows for postgis or pgrouting: extension packages are unavailable, not merely disabled. No schema changes or data rewrites were performed by this audit. Chain: 572d27b80883 → 80ebcb64f752 → 441d5178d7b4 → b63d129fe407 → c7a3f10d942b → d8b4a21e653c. Earlier README revision tables are historical and omit newer changes; source migrations and actual database revision were checked directly.

## Integration and regression risks

Use the existing Maps tab with isolated features/maps modules. Add backend /api/geo routers and a geographic namespace instead of replacing messaging models. Keep source identities stable and retain all current tables. Add explicit moderation roles before any report can affect routes. Use the existing fetch/SSE parsing conventions but introduce shared event transport and durable replay/snapshot semantics before multiple workers; current in-memory sessions also prevent horizontal scaling.

Future spatial migrations require an ARM-compatible PostgreSQL 17 image containing PostGIS/pgRouting, tested backups/restores and explicit extension privileges. The existing deployment guard refuses database service changes; do not bypass it to swap production images. Use an isolated test database first. No native compiler/device or real geographic integration tests have passed by virtue of JS export success.

## Development commands

`docker compose --env-file deploy/local.env -f compose.yaml -f compose.dev.yaml up -d db`; `cd backend && uv sync --locked && uv run --locked alembic upgrade head`; from the app folder `./scripts/start-dev.sh`. For iPhone: `BACKEND_HOST=0.0.0.0 ./scripts/start-dev.sh --dev-client --lan`. Install frontend via npm ci. New native dependencies require a new development binary. Production deployment is separate and is not authorized as part of the mapping audit.
