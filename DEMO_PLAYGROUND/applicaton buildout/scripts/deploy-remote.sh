#!/usr/bin/env bash
# Invoked by deploy_ec2.py after a checksummed release upload.
set -Eeuo pipefail
umask 077
ROOT="$1"
RELEASE="$2"
ORIGIN="$3"
MIGRATE="$4"
PROJECT="${5:?Missing existing cloud Compose project name}"
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo 'Invalid Compose project name' >&2; exit 1; }
cd "$ROOT"
test -f compose.yaml && test -f deploy/ec2.env
mkdir "$ROOT/.deploy-lock" || { echo 'Another deployment is active; investigate .deploy-lock.' >&2; exit 1; }
CHANGED=no
SCHEMA_CHANGED=no
old() { sudo -n docker compose -p "$PROJECT" --project-directory "$ROOT" --env-file "$ROOT/deploy/ec2.env" -f "$RELEASE/previous-compose.yaml" "$@"; }
new() { sudo -n docker compose -p "$PROJECT" --project-directory "$ROOT" --env-file "$ROOT/deploy/ec2.env" -f "$RELEASE/compose.yaml" "$@"; }
cleanup() {
    rm -f "$RELEASE/old-config.json" "$RELEASE/new-config.json"
    rmdir "$ROOT/.deploy-lock"
}
failed() {
    local status=${1:-$?}
    trap - ERR INT TERM
    set +e
    if [[ "$CHANGED" == yes ]]; then
        echo 'Deployment failed; attempting to restart the previous API/web images.' >&2
        if old up -d --no-build --no-deps --force-recreate --wait --wait-timeout 120 api &&
           old up -d --no-build --no-deps --force-recreate --wait --wait-timeout 60 web; then
            echo 'Previous API/web images restarted.' >&2
        else
            echo 'Automatic image rollback failed; manual recovery is required.' >&2
        fi
        if [[ "$SCHEMA_CHANGED" == yes ]]; then
            echo "Migrations were attempted. Image rollback does not undo schema changes; inspect the backup at $RELEASE/database-before.dump." >&2
        fi
    fi
    exit "$status"
}
trap cleanup EXIT
trap failed ERR
trap 'failed 130' INT
trap 'failed 143' TERM
cp compose.yaml "$RELEASE/previous-compose.yaml"
cd "$RELEASE"
sha256sum -c SHA256SUMS
old config --format json > old-config.json
new config --format json > new-config.json
python3 - "$ORIGIN" <<'PY'
import json, sys
old=json.load(open('old-config.json')); new=json.load(open('new-config.json'))
if old.get('networks') != new.get('networks'):
    raise SystemExit('Refusing an update that changes networks')
old_volumes = old.get('volumes', {}); new_volumes = new.get('volumes', {})
if any(new_volumes.get(key) != value for key, value in old_volumes.items()):
    raise SystemExit('Refusing an update that changes existing volumes')
added = set(new_volumes) - set(old_volumes)
if added - {'avatar-data'}:
    raise SystemExit('Refusing unexpected new volumes')
if added:
    avatar = new_volumes['avatar-data']
    project = new['name']
    if avatar.get('name') != project + '_avatar-data' or avatar.get('external') or avatar.get('driver', 'local') != 'local' or avatar.get('driver_opts'):
        raise SystemExit('Refusing nonstandard avatar storage volume')
if old['services']['db']!=new['services']['db']: raise SystemExit('Refusing an update that changes the database service')
if old['services']['web'].get('ports')!=new['services']['web'].get('ports'): raise SystemExit('Refusing an update that changes the Nginx upstream port')
if new['services']['api']['environment']['FRONTEND_URL']!=sys.argv[1]: raise SystemExit('Cloud APP_ORIGIN does not match the frontend build; update server configuration separately')
env = new['services']['api']['environment']
for flag, url in [('GEO_DATA_ENABLED', 'GEO_DATABASE_URL'), ('GEO_REPORTS_ENABLED', 'GEO_REPORT_DATABASE_URL')]:
    if env.get(flag) == 'true' and not env.get(url):
        raise SystemExit(f'{flag} requires {url} in server deploy/ec2.env')
if env.get('GEO_ROUTING_ENABLED') == 'true' and env.get('GEO_DATA_ENABLED') != 'true':
    raise SystemExit('GEO_ROUTING_ENABLED requires GEO_DATA_ENABLED')
print('Existing database, network, volume, port, and origin settings verified.')
PY
# Never restore the Mac database during an update.
old exec -T db sh -c 'exec pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > database-before.dump
test -s database-before.dump
old exec -T db pg_restore --list < database-before.dump > /dev/null
gunzip -c images.tar.gz | sudo -n docker image load
if [[ "$MIGRATE" == yes ]]; then
    CHANGED=yes
    SCHEMA_CHANGED=yes
    old stop web api
    new run --rm --no-deps migrate
else
    # Prevent silently running a new app against an old schema.
    new run --rm --no-deps migrate python -c 'from alembic.config import Config; from alembic.script import ScriptDirectory; from sqlalchemy import text; from app.services.database import engine; expected=set(ScriptDirectory.from_config(Config("alembic.ini")).get_heads()); connection=engine.connect(); actual=set(connection.execute(text("SELECT version_num FROM alembic_version")).scalars()); connection.close(); assert actual==expected, "Schema upgrade needed: rerun with --migrate during a maintenance window"'
fi
CHANGED=yes
new up -d --no-build --no-deps --force-recreate --wait --wait-timeout 120 api
# Recreate web after API to refresh its Nginx upstream DNS resolution.
new up -d --no-build --no-deps --force-recreate --wait --wait-timeout 60 web
PORT=$(python3 -c 'import json; print(json.load(open("new-config.json"))["services"]["web"]["ports"][0]["published"])')
curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:$PORT/api/health" > /dev/null
curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:$PORT/api/data" > /dev/null
curl --fail --silent --show-error --max-time 15 "$ORIGIN/api/health" > /dev/null
curl --fail --silent --show-error --max-time 15 "$ORIGIN/auth/callback" > /dev/null
cp compose.yaml "$ROOT/compose.yaml.next"
mv "$ROOT/compose.yaml.next" "$ROOT/compose.yaml"
CHANGED=no
printf '%s\n' "$RELEASE" > "$ROOT/deploy/last-release"
echo "Verified deployment: $ORIGIN"
echo "Database backup and previous Compose configuration retained: $RELEASE"
