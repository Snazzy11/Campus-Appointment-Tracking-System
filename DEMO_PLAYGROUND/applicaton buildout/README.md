# Application buildout workspace

This folder, `applicaton buildout`, is a source clone of sibling `groupdemo`. It is the workspace for the next phase. The four-tab navigation shell and profile/account entry point are implemented. See [BUILDOUT.md](BUILDOUT.md) for progress and the agreed implementation order.

Editable profiles are implemented. This buildout now uses its own local database (`campus_buildout`, port 5434), Compose project (`campus-buildout`), and image tags. See [profile setup](deploy/PROFILES.md) for local startup, photo storage, and the required iPhone development-build refresh. The messaging inbox/chat redesign is implemented: searchable conversations, latest previews, per-chat drafts, phone chat views, and desktop panes. Next is broader end-to-end and accessibility testing.

Cloud deployment still targets messaging.tufts.pro and preserves its existing cloud database. S3 support is prepared; its bucket and runtime permissions have not been created. The inherited instructions below use updated local names; historical EC2 runbooks retain the real cloud project identity.

---

# Groupdemo — Campus Messaging group chat development

This is a sibling copy of `ec2demo`, used for local development. It has its own Compose project (`campus-buildout`), database (`campus_buildout`), and Docker images. No cloud deployment or changes to the original project are needed to test groups.

## Features

- Public chat and direct messages remain available.
- Create a named group, optionally select initial members by verified email prefix, and add members later. Names are limited to 80 characters; groups support 50 members.
- The creator becomes the first owner. Owners can rename groups, add/remove members, and promote any current member to owner. Multiple owners are stored in `conversation_owners`, referencing membership.
- Any member can leave, but the final owner must first promote another member. Owners have equal permissions, including after the creator leaves.
- Every current member can read the complete history, including messages sent before they joined. The app fetches the latest 100 messages and offers **Load earlier messages**.
- Creation, additions, removals, departures, renames, and promotions generate persistent system messages. The change and its message commit together. Clients cannot forge system messages.
- Private streams update membership and messages live. Removed members lose read/write access; queued stream messages are checked against current membership before delivery.

## Local development: Expo + uv

Stop any other frontend on 8081 or API on 8000 first. These ports and the `campusmessaging` URL scheme reuse the existing development Cognito callbacks.

1. Install Docker, Node/npm, and uv. Run `npm ci` in `frontend` and `uv sync --locked` in `backend`.
2. Copy `deploy/local.env.example` to `deploy/local.env`. Set local database credentials and existing Cognito public client settings. Set `backend/.env` to the same DB credentials, `DB_NAME=campus_buildout`, `DB_HOST=127.0.0.1`, and `DB_PORT=5434`. Keep its local Cognito callback settings. The cloned private environment file already uses the separate database name and port; do not point it at the EC2 database.
3. From this folder, start only the dedicated database:

```sh
docker compose --env-file deploy/local.env -f compose.yaml -f compose.dev.yaml up -d db
cd backend
uv run --locked alembic upgrade head
cd ..
./scripts/start-dev.sh
```

The script defaults to Expo Go and localhost. For iPhone testing, use `BACKEND_HOST=0.0.0.0 ./scripts/start-dev.sh --dev-client --lan`. Cognito native login requires the existing development build; Expo Go cannot use its custom callback scheme. The phone must reach the Mac over the same network. Rebuilding native code is unnecessary for these JavaScript changes.

Sign in with two or more existing Cognito accounts to populate this separate local database. The recipient picker searches verified accounts that have signed in here, starting at three typed characters. The EC2 users/messages are not automatically copied into this database.

## Optional container web preview

After configuring `deploy/local.env`:

```sh
docker compose --env-file deploy/local.env build api web
docker compose --env-file deploy/local.env up -d db
docker compose --env-file deploy/local.env run --rm migrate
docker compose --env-file deploy/local.env up -d api web
```

Open http://localhost:18083. Add `http://localhost:18083/auth/callback` to the Cognito client's allowed callback URLs and the origin to its allowed logout URLs if you use this preview. No host Nginx changes are needed. The database volume belongs to this Compose project. Do not delete it if you want to retain test history.

## Backend API and schema

Authenticated group endpoints:

| Method/path | Body/action |
| --- | --- |
| POST `/api/groups` | `{name, member_ids: []}`; creator included automatically |
| POST `/api/groups/{id}/rename` | `{name}`; owner only |
| POST `/api/groups/{id}/members` | `{user_id}`; owner adds member |
| POST `/api/groups/{id}/remove-member` | `{user_id}`; owner removes member |
| POST `/api/groups/{id}/promote` | `{user_id}`; owner promotes member |
| POST `/api/groups/{id}/leave` | No body; current member leaves |

Conversation responses include `name`, `members`, and `owner_ids`. History uses GET `/api/conversations/{id}/messages?limit=100&before_id=...`, ordered oldest to newest within each page. Messages have `kind=user|system`; system messages have a null user ID. Private SSE also emits `conversation_updated` with conversation ID and removed user IDs.

Migration `c7a3f10d942b` adds group names, ownership, message kind, and a history index after the verified-email migration. Existing DM/public data remains valid. PostgreSQL conversation row locks serialize membership, ownership, and message operations. Downgrade refuses while groups exist to prevent silently discarding group semantics.

## Verification

```sh
cd backend
uv run --locked pytest -q
uv run --locked ruff check app tests migrations/versions/c7a3f10d942b_add_group_chats.py
cd ../frontend
npm run lint
npm run typecheck
npm test
npx expo export --platform all
```

Backend coverage includes owner authorization, last-owner protection, pre-join history pagination, removal access/queued-stream filtering, transaction rollback, duplicate actions, and DM compatibility. Streams are in-process; keep one API worker until shared event delivery is implemented.

## Deploy updated groupdemo code to EC2

The deployment script is configured to update **https://messaging.tufts.pro**, preserving the existing cloud users/messages. It builds from this folder with `campus-buildout-*` image tags, while retaining the server directory `/home/ubuntu/apps/ec2demo` and Compose project `campus-ec2demo` so existing volumes and networks are reused. Local development keeps its separate `campus-buildout` project.

```sh
./scripts/deploy-ec2.sh --dry-run --migrate
./scripts/deploy-ec2.sh --migrate
```

The first group-chat release requires `--migrate`. The script backs up the cloud database before applying migrations, briefly stops messaging API/web, then verifies the updated services. It retains the server's credentials, database and host port; it does not upload the local database. Subsequent updates without schema changes can omit `--migrate`.

See [deployment and recovery instructions](deploy/REDEPLOY.md). The private `deploy/deploy-settings.json` contains this Mac's SSH destination and existing cloud project identity and is ignored by Git. Editing the scripts has not deployed the group-chat release.


## CMU campus navigation work

The staged geospatial requirements and progress are recorded in [docs/geospatial/STATUS.md](docs/geospatial/STATUS.md), with the [current architecture audit](docs/architecture/current-system.md), [proposed geospatial design](docs/architecture/geospatial-design.md), and [test baseline](docs/testing/baseline.md). The Maps tab now has a MapLibre foundation, disabled until licensed provider configuration is supplied. Follow [provider setup](docs/geospatial/PROVIDER-SETUP.md); future stages require spatial integration tests and native verification.

Campus spatial data development: [Stage 2 setup, schema, import, tests and recovery](docs/geospatial/stage-2.md). Uses its own local database at port5435; geographic API remains opt-in and no production database is replaced.

[Stage 3 building search, local preview, API contracts and verification](docs/geospatial/stage-3.md).

### Local pedestrian routing (Stage 4)

Maps now supports origin/destination selection, Walking/Shortest/Step-free profiles, route distance/time and a path summary. See [Stage 4 setup, API, validation and limitations](docs/geospatial/stage-4.md). Requires the isolated spatial database, explicit geo003 migration/build-graph and GEO_ROUTING_ENABLED=true; ordinary messaging startup does not run geographic migrations. Routes use incomplete source data and do not guarantee accessibility. Parking/GIS corrections and native device verification remain pending.
