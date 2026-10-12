# FastAPI messaging backend

Entry point: `app.main:app`, run with the backend directory as the working directory. `main.py` registers authentication, public messages, conversations, and private-stream routers. CORS permits GET/POST with Content-Type and Authorization for FRONTEND_ORIGINS. The Expo app calls an absolute API URL and sends bearer sessions, so cross-origin cookies are not required. Legacy browser cookie routes remain available.

## Configuration

`app/services/database.py` explicitly loads `backend/.env`; `auth.py` also calls `load_dotenv()`. Existing environment variables take precedence over dotenv defaults. Do not copy actual credentials into documentation or commit `.env`.

Example values below are placeholders:

```dotenv
DB_USER=campus_app
DB_PASSWORD=replace_with_local_password
DB_NAME=campus_messaging
DB_HOST=127.0.0.1
DB_PORT=5432
COGNITO_DOMAIN=https://your-domain.auth.your-region.amazoncognito.com
COGNITO_CLIENT_ID=your_app_client_id
COGNITO_REDIRECT_URI=http://localhost:8000/auth/callback
COGNITO_APP_REDIRECT_URIS=campusmessaging://auth/callback,http://localhost:8081/auth/callback,http://127.0.0.1:8081/auth/callback
FRONTEND_URL=http://localhost:8081
FRONTEND_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
COOKIE_SECURE=false
COGNITO_REGION=your-region
COGNITO_USER_POOL_ID=your_user_pool_id
```

| Variable | Behavior |
| --- | --- |
| DB_USER, DB_PASSWORD, DB_NAME | Required on database-module import |
| DB_HOST / DB_PORT | Default to `127.0.0.1` / `5432`; port parsed as integer |
| COGNITO_DOMAIN | Required; trailing slash stripped; authorize/token base URL |
| COGNITO_CLIENT_ID | Required; authorization client and ID-token audience |
| COGNITO_REDIRECT_URI | Required; same URI sent during authorize and token exchange |
| COGNITO_REGION / COGNITO_USER_POOL_ID | Required; construct issuer and signing-key URL |
| COGNITO_APP_REDIRECT_URIS | Comma-separated exact callback allowlist for Expo session exchange; defaults to native scheme and localhost/127.0.0.1 port-8081 web callbacks |
| FRONTEND_URL | Legacy successful callback/logout redirect and logout Origin; default http://localhost:8081 |
| FRONTEND_ORIGINS | Browser CORS origin list; default port-8081 origins plus historical port-5173 origins |
| COOKIE_SECURE | Legacy cookie Secure flag; true under HTTPS, false by default |

The Cognito app client must support the implemented authorization-code/PKCE flow and requested `openid email profile` scopes, with the exact callback URI registered. Token exchange does not send a client secret. The legacy browser callback can go directly to port 8000; successful callbacks redirect to FRONTEND_URL. The Expo app uses its own callback URI and the JSON session exchange below. Remote Cognito configuration was not modified or verified.

The engine uses `postgresql+psycopg`, `URL.create` for credential construction, and `pool_pre_ping=True`. Request dependencies open and close synchronous SQLAlchemy sessions. `check_database_connection()` issues `SELECT current_database(), current_user` when explicitly called; `/api/health` does not call it. There is no startup schema creation or database probe.

## Start and schema management

```sh
uv sync --locked
uv run --locked alembic upgrade head
uv run --locked uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Use --host 0.0.0.0 when a physical device must reach your development API. `--reload` is optional for manual development but absent from the launcher. Run one worker. Read [migration documentation](migrations/README.md) before using `uv run --locked python -m scripts.init_db` on a database with migration history.

`pyproject.toml` is the dependency source, `uv.lock` pins resolutions, `.python-version` selects Python 3.14, and uv manages `.venv`. `uv sync --locked` refuses stale dependency metadata. Change packages with `uv add`/`uv remove`, commit the resulting lock, and regenerate compatibility requirements with `uv export --locked --no-dev --no-hashes --output-file requirements.txt`. Do not edit the exported requirements file manually.

Production dependencies include FastAPI/Uvicorn, HTTPX, python-dotenv, PyJWT crypto, SQLAlchemy, psycopg, and Alembic. The dev group provides pytest and Ruff. Run `uv run --locked pytest -q` and `uv run --locked ruff check app scripts tests` for backend checks; tests use SQLite and mocked Cognito.

## Expo authentication lifecycle

1. `/api/auth/config` supplies only the public Cognito domain/client ID.
2. Expo AuthSession requests a code using PKCE and state. The client verifies state before submitting the code/verifier/redirect to `/api/auth/session`.
3. The backend requires a 43–128 character RFC-compatible verifier and an exact URI from COGNITO_APP_REDIRECT_URIS; it exchanges the code with Cognito using that same URI.
4. Shared exchange logic verifies the RS256 ID token, audience, issuer, required claims, and token_use=id. A nonempty email is required before a session is created. JWKS lookup runs in a threadpool to avoid blocking the async event loop.
5. The response contains `{session_token, expires_in:28800}`. Tokens are opaque random IDs backed by process-local sessions. Native clients persist them in SecureStore; web keeps them in memory.
6. Authorization: Bearer authenticates /api/me, public writes, private requests, and private SSE. If an Authorization header is present it takes precedence, including when invalid; credentials do not fall back to a cookie.
7. `/api/me` creates/updates the local database user and returns its numeric ID alongside subject/email. `/api/auth/logout` requires a valid bearer header, deletes the session, and returns 204; cookie-only requests are rejected.

Provider HTTP failures during Expo code exchange return 502. Disallowed redirects return 400; malformed verifiers return 422. Cognito failed exchange returns 400, invalid tokens 401, and missing email 400. The backend never returns Cognito ID/access/refresh tokens to the app.

## Legacy browser authentication lifecycle

1. `GET /auth/login` creates a random PKCE verifier, SHA-256 challenge, and state. It sets `oauth_state` and `oauth_verifier` cookies for 600 seconds on `/auth`, then redirects to Cognito.
2. `/auth/callback` rejects provider errors or missing/mismatched state, exchanges the code with a 10-second HTTPX timeout, and retrieves the ID token.
3. PyJWT retrieves a signing key from the pool JWKS endpoint and validates RS256 signature, client audience, issuer, required `exp/iat/sub/iss/aud`, and `token_use=id`.
4. A random opaque session ID maps to subject, email, and expiry in `sessions.py`. The callback sets `campus_session` on `/` for eight hours, clears the OAuth cookies on success, and redirects to FRONTEND_URL with 303.
5. `/api/me` now resolves the authenticated database user and returns its numeric ID. Authenticated messaging dependencies also create/update users by Cognito subject as needed.
6. `/auth/logout` requires Origin to match FRONTEND_URL, deletes the local session/cookie, and redirects with 303. It does not log out the Cognito hosted session.

Cookies are HttpOnly, SameSite=Lax; COOKIE_SECURE is configurable for HTTPS. Sessions have a fixed eight-hour expiry and no renewal/refresh flow. Both login paths require an email claim. Private streams recheck session validity during their event/keepalive loop and close after revocation/expiry, allowing the client to reconnect and receive 401.

## HTTP API

All message requests use JSON `{ "text": "Hello" }`. Both backend message schemas allow 1–5000 characters; they do not trim whitespace. Schema violations normally produce FastAPI 422 responses.

| Method/path | Authentication | Result |
| --- | --- | --- |
| GET /api/health | None | `{"status":"ok","service":"campus-messaging"}`; process health only |
| GET /api/hello | None | `{"message":"Hello from Python!"}` |
| GET /auth/login | None | Redirect and temporary OAuth cookies |
| GET /auth/callback | OAuth state cookies | Login completion or 400/401 |
| POST /auth/logout | Exact FRONTEND_URL Origin | Legacy cookie logout, 303; invalid Origin gives 403 |
| GET /api/me | Session | `{authenticated:true,id,sub,email}`; creates/updates DB user; otherwise 401 |
| GET /api/auth/config | None | `{domain,client_id}` public OAuth metadata |
| POST /api/auth/session | PKCE authorization code | `{code,code_verifier,redirect_uri}` → `{session_token,expires_in}` |
| POST /api/auth/logout | Bearer session | Revoke session, HTTP 204; missing/invalid bearer 401 |
| GET /api/data | None | Latest 100 public messages, returned in ascending ID order |
| POST /api/data | Optional session | Saved public message, HTTP 200 |
| GET /api/stream | None | Public SSE stream; live events only |
| POST /api/conversations | Session | `{recipient_id:positive_integer}`; create/reuse DM, HTTP 201 in either case |
| GET /api/conversations | Session | Own conversations, newest creation first |
| GET /api/conversations/{id}/messages | Session + membership | Latest 100 private messages, ascending ID order |
| POST /api/conversations/{id}/messages | Session + membership | Saved private message, HTTP 201 |
| GET /api/private/stream | Session | User-scoped named private SSE events |

There is no `/api/messages` route. Unknown/private nonmember conversations return 404 (`Conversation not found`); an absent private session returns 401 (`Authentication required`). Creating a self-DM returns 400; an unknown recipient returns 404. There is no conversation-creation notification until a private message is sent.

Public message shape:

```json
{"id": 42, "sender": "student@example.edu", "text": "Hello", "created_at": "2026-10-12T15:00:00+00:00"}
```

Private message shape adds `conversation_id` and `user_id`. Conversation responses contain `id`, `type`, `created_at`, and `members` (objects with `id` and `email`, ordered by user ID). Internal `direct_key` is not returned. Numeric IDs and timestamps here are illustrative.

## Data model

| Table | Columns and constraints |
| --- | --- |
| users | Integer PK `id`; unique indexed non-null `cognito_sub` (255); non-null `email` (320); server timestamp `created_at` |
| conversations | Integer PK; `type` (20), default `direct`; server timestamp; nullable unique `direct_key` (100) |
| conversation_members | Composite PK `(conversation_id,user_id)`; FKs cascade on parent deletion; indexed user ID; server timestamp `joined_at` |
| messages | Integer PK; nullable indexed user FK; nullable indexed conversation FK; non-null sender (320), text; server timestamp |

`conversation_id IS NULL` defines public messages. Private messages carry a conversation ID. User and conversation message FKs have no database delete cascade; membership FKs do. ORM membership relationships use `all, delete-orphan`. No deletion routes are implemented.

For a direct pair, sorted user IDs produce `direct_key="smaller:larger"`. Creation first checks that key, then commits the conversation and both memberships together. On an integrity race it rolls back and retrieves the winning row. Database uniqueness enforces uniqueness only for populated keys; historical NULL keys are not backfilled by the migration.

## Message delivery and concurrency

Public POST performs synchronous database operations in an async route, commits, then enqueues a serialized message to each process-local public subscriber. Public SSE registers a bounded queue of 100, initially sends `: connected`, then ordinary `data:` events and 15-second keepalive comments. It removes the subscriber when the generator exits. There is no history replay or Last-Event-ID support.

Private POST authenticates the sender, copies scalar identity values, and runs its save operation through `run_in_threadpool`. That worker creates its own SQLAlchemy session, verifies membership, commits, builds the response, and retrieves member IDs. Only after commit does the event-loop code publish to those users' queues. Each user can have multiple connected tabs.

Private events have this wire format:

```text
event: private_message
data: {"id":42,"conversation_id":7,"user_id":3,"sender":"student@example.edu","text":"Hello","created_at":"2026-10-12T15:00:00+00:00"}

```

Private streams emit a keepalive comment after 20 seconds without events and unsubscribe on generator finalization. Queue overflow now unregisters the slow subscriber and inserts a close sentinel in both public/private queues. After retained queued events drain, the generator closes so clients reconnect and reload history; public overflow no longer fails a committed write. Private streams initially send `: connected` and check current session validity between events/keepalives. Neither delivery path is transactional with persistence, and a process crash after commit can still lose notifications until history recovery.

## Maintenance map and limits

- `routers/auth.py`: shared Cognito verification, Expo code exchange/config/logout, legacy cookie routes/settings.
- `routers/messages.py`: active public database history, writes, and SSE queues.
- `routers/conversations.py`: membership checks, direct-pair creation, private history/writes.
- `routers/private_stream.py` + `services/private_events.py`: per-user private delivery.
- `services/auth_dependency.py`: session-to-database-user resolution.
- `services/database.py` / `db_dependency.py`: engine and session lifetime.
- `services/sessions.py`: process-local login state.
- `services/messaging.py`: leftover in-memory MessageStore; not imported by active routers.

There are no pagination cursors, read receipts, group management endpoints, message moderation, search, rate limiting, or general CSRF enforcement. Membership is enforced at the application level; the schema does not itself enforce two-member conversations or require message senders to be members. These observations describe existing code, not changes made by this documentation pass.
