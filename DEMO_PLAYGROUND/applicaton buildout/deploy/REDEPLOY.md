For profile photos, complete the separate [S3 and Nginx setup](PROFILES.md) before cloud testing. The profile migration also requires `--migrate`.

# Update the existing EC2 messaging deployment

From `messaging_platform/applicaton buildout` on your Mac:

```sh
./scripts/deploy-ec2.sh --dry-run
./scripts/deploy-ec2.sh
```

The private `deploy/deploy-settings.json` on this Mac is already configured for ubuntu@hacker.tufts.me, the existing toy-key.pem, /home/ubuntu/apps/ec2demo, and https://messaging.tufts.pro. It is ignored by Git. On another checkout, copy deploy/deploy-settings.json.example to deploy/deploy-settings.json and edit its five fields. There is no implicit cloud destination in a fresh checkout.

The local source and image tags are `applicaton buildout` / `campus-buildout-*`. The target is deliberately still `/home/ubuntu/apps/ec2demo` with `compose_project: campus-ec2demo`: this is the identity of the existing cloud database, networks, and containers. Renaming that target would create a different stack. Local Compose remains `campus-buildout` with its separate development database.

Deploying the current schedules and individual events for the first time needs the new schema:

```sh
./scripts/deploy-ec2.sh --dry-run --migrate
./scripts/deploy-ec2.sh --migrate
```

Migrations preserve existing users/messages and apply all pending application schema changes, including schedule terms, courses, and individual events. A backup is taken first; messaging pauses while migrations run. Later updates without new migrations can omit `--migrate`.

Requirements: Python 3.11+, Docker running locally, SSH/SCP, the existing SSH key, and an already deployed server with passwordless sudo for Docker, Python 3, curl, sha256sum, and Compose supporting --wait. SSH must already trust the server's host key; the script uses StrictHostKeyChecking=yes and does not change known_hosts. Do not bypass a host-key mismatch. No uv/npm installation on the server is needed.

## What the command does

1. Reads the server architecture and checks that the existing messaging database is running.
2. Builds both images on the Mac for that architecture. Uses current local source, including uncommitted edits; it does not pull GitHub changes automatically. The web API URL comes from the explicit deployment settings.
3. Assigns unique release tags, exports/compresses the images, and uploads them with a checksummed release-specific Compose file. It does not upload local env files or the Mac database.
4. Takes an exclusive deployment lock. Validates that database service, networks, volumes, and host port are unchanged and the server origin matches the built frontend.
5. Makes a fresh custom-format backup of the cloud database and validates the archive listing.
6. Checks the database migration revision against the new image. Fails before replacing services if a migration is needed, unless --migrate was explicitly supplied.
7. Replaces only API and web, without starting/recreating their dependencies. Waits for API health (including DB connectivity), then recreates web so its Nginx resolves the new API container.
8. Checks loopback API health/history and public HTTPS health/callback. Saves the new version-pinned Compose file as the server's active compose.yaml only after checks pass.

This updates the hosted web frontend and API. Installed iPhone/Android binaries still need a separate Expo/Xcode/EAS build when their native code changes.

This is a redeployment script, not initial server setup. It does not change host Nginx, certificates, DNS, Cognito, other Compose projects, cloud credentials, or the PostgreSQL container. Database-setting changes and new ports require a separate reviewed change.

The source compose.yaml continues to default to local use. The cloud release explicitly uses the selected HTTPS origin and secure cookies.

## Migrations and interruptions

Ordinary updates briefly interrupt messaging and invalidate in-memory login sessions. Users may need to sign in again. Existing unrelated applications are not restarted.

When your update adds a migration, review it first and choose a maintenance window:

```sh
./scripts/deploy-ec2.sh --migrate
```

This flag authorizes the migration service to apply the schema changes. After the backup, the script stops messaging API/web before running migrations, then starts the updated images. It does not automatically restore an earlier database: that could discard newly received messages. Code must be compatible with the migrated schema if an image rollback becomes necessary.

## Failures and recovery

Before cutover, failures leave the current application running. After cutover starts, failures trigger an attempt to recreate the prior API/web images using the prior Compose file. The script reports if that attempt fails. Database schemas are not rolled back automatically.

Each server release lives under /home/ubuntu/apps/ec2demo/releases/<timestamp-id> and contains the uploaded images, checksums, previous-compose.yaml, and database-before.dump. These directories are private. deploy/last-release records the successful release. The temporary local archive is removed when the command exits.

For an ordinary image rollback, choose the previous-compose.yaml from the failed/new release and use it with the existing server env file, project name, and root directory:

```sh
cd /home/ubuntu/apps/ec2demo
# Replace RELEASE with the actual release directory you want to undo.
sudo docker compose -p campus-ec2demo --project-directory "$PWD" --env-file deploy/ec2.env -f releases/RELEASE/previous-compose.yaml up -d --no-build --no-deps --force-recreate --wait api
sudo docker compose -p campus-ec2demo --project-directory "$PWD" --env-file deploy/ec2.env -f releases/RELEASE/previous-compose.yaml up -d --no-build --no-deps --force-recreate --wait web
# After verifying health, retain the rollback as the active config:
cp releases/RELEASE/previous-compose.yaml compose.yaml
```

If a migration was applied, review schema compatibility first. Use database backup restoration only as a deliberate recovery operation. Backups represent a point in time, not ongoing replication.

Release archives, images, and backups are retained on EC2; monitor disk usage and copy database backups off-instance privately. The script intentionally does not run global Docker prune or delete older releases. A dropped SSH connection/server crash can leave .deploy-lock; investigate the deployment state before manually removing that lock.

## Local verification

```sh
python3 -m unittest discover -s scripts/tests -v
bash -n scripts/deploy-ec2.sh scripts/deploy-remote.sh
./scripts/deploy-ec2.sh --dry-run
```

Tests also verify buildout image rendering and preservation of the explicit cloud Compose project. Tests use fake Docker commands and disposable directories. They verify success, unchanged database configuration, schema mismatch before cutover, API failure rollback, migration failure behavior, configuration validation, and a dry run with no network commands. They do not redeploy EC2.

Reference: [Docker Compose service startup, --no-deps, and health waiting](https://docs.docker.com/reference/cli/docker/compose/up/).

## Current maps and spatial services

Cloud web builds now enable the Maps tab by default, using the app's OpenFreeMap
street style (`https://tiles.openfreemap.org/styles/liberty`); no MapTiler key is required.
The deployment supplies this fallback when neither a street style nor a MapTiler key
is set; it does not depend on the local frontend `.env` file. Local development defaults are unchanged.
Optional public build settings belong in the local `deploy/deploy-settings.json`:

```json
"web_build": {
  "EXPO_PUBLIC_MAPS_ENABLED": "true",
  "EXPO_PUBLIC_MAP_STREET_STYLE": ""
}
```

Add this property alongside the five existing connection fields. Supported keys are
`EXPO_PUBLIC_MAPS_ENABLED`, `EXPO_PUBLIC_MAPTILER_KEY`, `EXPO_PUBLIC_MAP_STREET_STYLE`,
`EXPO_PUBLIC_MAP_SATELLITE_STYLE`, and `EXPO_PUBLIC_MAP_HYBRID_STYLE`.
Shell environment values override these settings. All values must be strings;
these are public values embedded in the browser bundle, never secrets. Server-side
env changes cannot alter an already built frontend; rebuild to change them.

The basemap can display without PostGIS. Building search, directions, building-linked
events, and map reports additionally require the separate spatial database and data.
The redeploy command does **not** create or copy that database. `--migrate` applies
messaging/schedule migrations only, not spatial migrations or map imports.
Do not layer the local `compose.spatial.yaml` onto the production compose file:
it defines a service named `db` and uses local-only credentials.

After provisioning a separate production spatial database and applying the spatial
migrations/imports described in `docs/geospatial`, set these in the **existing server**
`deploy/ec2.env`, preserving its other values:

```dotenv
GEO_DATA_ENABLED=true
GEO_DATABASE_URL=postgresql+psycopg://READ_ONLY_USER:PASSWORD@SPATIAL_HOST:5432/campus_spatial
GEO_ROUTING_ENABLED=true
GEO_REPORTS_ENABLED=true
GEO_REPORT_DATABASE_URL=postgresql+psycopg://REPORT_WRITER:PASSWORD@SPATIAL_HOST:5432/campus_spatial
```

Use properly URL-encoded credentials and a hostname reachable from the API container.
`localhost` refers to the API container itself. Keep report writing on its separate
least-privilege credential. Routing requires the imported, built graph; reports require
the report schema and role setup. Leave flags false until those prerequisites are ready.
The deployment validates missing URLs and inconsistent routing flags before cutover;
it does not certify spatial data completeness. Existing cloud spatial settings are now
passed into the API. Test building search, a known route, and report access after setup.

## Spatial setup status

Production search and walking routing were enabled on October 14, 2026. See
[SPATIAL.md](SPATIAL.md) for the isolated service, bootstrap, and backup instructions.
The new chat scheduling tools require `--migrate`; see
[chat schedules](../docs/messaging/chat-schedules.md).
