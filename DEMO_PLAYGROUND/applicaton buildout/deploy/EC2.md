> Historical setup for the existing cloud stack. For groupdemo updates, follow [REDEPLOY.md](REDEPLOY.md); retain the existing server directory, database, and project name.

# EC2 Docker deployment: messaging.tufts.pro

Status: **deployed October 12, 2026** at https://messaging.tufts.pro on the existing upgraded ARM EC2 instance. Server workspace: /home/ubuntu/apps/ec2demo. The current source database was copied into a separate PostgreSQL container. Existing Nginx files were preserved and verified by checksums; one new messaging site was added and Nginx was gracefully reloaded. This runbook describes initial setup as well as the deployed arrangement.

## What runs where

Existing host Nginx terminates HTTPS for messaging.tufts.pro and proxies to **127.0.0.1:18080**. This project's web container serves the Expo static web export and proxies /api/ to FastAPI. FastAPI runs one worker because sessions and live events are in memory. PostgreSQL has its own persistent Compose volume and no published port. API also has no published port. Nothing binds host ports 80, 443, 8000, or 5432.

Compose project name is campus-ec2demo. Only this project's resources are managed by these commands. Runtime budgets default to API 384 MB, web 128 MB, PostgreSQL 512 MB, with CPU limits and rotating logs. Containers share the EC2 host; these limits do not guarantee that existing applications remain unaffected. The supplied server inventory reports 1.8 GiB RAM, 572 MiB available, and 1 GiB of swap used. The user upgraded the instance to t4g.medium; post-upgrade inventory reported 3.7 GiB RAM, 2.1 GiB available, and no swap use before deployment. Inspect available RAM, CPU, disk, existing Docker workloads, and port 18080 again after resizing. See [UPGRADE.md](UPGRADE.md). Image builds are not constrained by runtime limits: build on your Mac or CI for the server architecture, then transfer images.

## 1. Read-only server inventory

In your existing SSH session:

```sh
uname -m
free -h
df -h
sudo ss -lntp
docker --version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Ports}}'
sudo nginx -t
```

If Docker is absent, prepare its installation separately after reviewing the existing host networking/firewall and services. Do not reinstall Docker, restart Nginx, or replace default site files as part of this deployment. The current Docker installation method and Ubuntu version need checking first.

## 2. Configure deployment environment

On your Mac, from ec2demo:

```sh
# A private deploy/ec2.env has already been prepared locally.
# Only when setting up a new checkout with no env file:
# cp deploy/ec2.env.example deploy/ec2.env
chmod 600 deploy/ec2.env
```

The prepared deploy/ec2.env reuses existing Cognito settings and contains a newly generated database password. Review it privately before transfer; do not overwrite it with the example. In a fresh checkout, fill in the example values yourself. It is the deployment configuration; backend/.env and frontend/.env are local development files and are excluded from Docker images. Never commit ec2.env or export rendered Compose config to public logs: it includes credentials. Validate without printing secrets:

```sh
docker compose --env-file deploy/ec2.env config --quiet
```

For EC2, set COOKIE_SECURE=true explicitly in deploy/ec2.env. Local Compose defaults to COOKIE_SECURE=false and APP_ORIGIN=http://localhost:18080.

APP_ORIGIN=https://messaging.tufts.pro is embedded into the web bundle. Changing it requires rebuilding the web image. For the installed native Expo app, set EXPO_PUBLIC_API_URL to this origin and reload the development bundle or rebuild a release. Production web uses exported static files, not Metro/Expo Go on port 8081.

In Cognito's existing app client, add https://messaging.tufts.pro/auth/callback to allowed callback URLs; retain campusmessaging://auth/callback for native login. Do not remove callbacks used by other applications. Compose provides the same allowlist to the backend and sets FRONTEND_ORIGINS to https://messaging.tufts.pro. Browser CORS is enforced by FastAPI; the Cognito callback allowlist is a separate setting. This PKCE frontend expects a public app client without a client secret. Web callback is served by Expo, not proxied to the legacy /auth/callback backend route.

## 3. Build away from the critical server

Use linux/amd64 for an x86_64 server; linux/arm64 for an aarch64 server. Docker Desktop must be running. The supplied target is aarch64; use linux/arm64. Example for this server:

```sh
export DOCKER_DEFAULT_PLATFORM=linux/arm64
docker compose --env-file deploy/ec2.env build
mkdir -p /private/tmp/campus-ec2-transfer
docker image save campus-ec2demo-api:local campus-ec2demo-web:local | gzip > /private/tmp/campus-ec2-transfer/images.tar.gz
```

Transfer that archive, compose.yaml, and deploy/ec2.env over SSH to a new private server directory (e.g. ~/apps/ec2demo). Transfer deploy/host-nginx.conf.example for later review. Replace user@server with your SSH destination:

```sh
ssh user@server 'mkdir -p ~/apps/ec2demo/deploy && chmod 700 ~/apps/ec2demo'
scp compose.yaml user@server:~/apps/ec2demo/
scp deploy/ec2.env deploy/host-nginx.conf.example user@server:~/apps/ec2demo/deploy/
scp /private/tmp/campus-ec2-transfer/images.tar.gz user@server:~/apps/ec2demo/
```

The transferred images support up --no-build; the source tree is not required for that workflow. On EC2:

```sh
cd ~/apps/ec2demo
chmod 600 deploy/ec2.env
gunzip -c images.tar.gz | sudo docker image load
sudo docker compose --env-file deploy/ec2.env pull db
sudo docker compose --env-file deploy/ec2.env up -d db
```

Postgres 17 is the initial target. Check the source database's major version before export/import; if it is newer, choose a compatible target and volume layout first. Keep that major version fixed after data is initialized. Changing POSTGRES_PASSWORD in ec2.env does not rotate an existing database password.

## 4. Choose an empty database or import current data

**Empty database:** initialize with the explicit migration service:

```sh
sudo docker compose --env-file deploy/ec2.env run --rm migrate
```

**Current database:** export a fresh custom-format backup from the actual source using pg_dump of the source major version or newer. Use PGPASSFILE or an interactive password prompt; do not put passwords in shell arguments/history. Run on the machine that can reach the source database:

```sh
pg_dump --format=custom --no-owner --no-acl --host SOURCE_HOST --username SOURCE_USER --dbname SOURCE_DATABASE --file campus-current.dump
```

Transfer it privately to EC2 and restore into the new, empty Compose database BEFORE running migrations:

```sh
sudo docker compose --env-file deploy/ec2.env exec -T db sh -c 'exec pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < campus-current.dump
sudo docker compose --env-file deploy/ec2.env run --rm migrate
```

Inspect the dump's schema and Alembic revision before migration. A database containing tables without alembic_version requires a schema review; do not blindly stamp or migrate it. The copied campus_messaging_before_dm.dump is an old snapshot and is excluded from images; it is not assumed to be a current backup. Never restore into any database belonging to existing server applications. Keep the original source database intact for rollback.

## 5. Verify privately before Nginx

```sh
sudo docker compose --env-file deploy/ec2.env up -d --no-build api web
sudo docker compose --env-file deploy/ec2.env ps
curl --fail http://127.0.0.1:18080/api/health
curl --fail http://127.0.0.1:18080/api/data
curl --fail -o /dev/null http://127.0.0.1:18080/auth/callback
sudo docker stats --no-stream
```

API healthcheck probes PostgreSQL as well as HTTP; /api/health alone only checks the API process. /api/data checks schema access. The HTTPS callback cannot complete login until the public hostname and Cognito allowlist are configured.

## 6. Add a separate host Nginx site

Point messaging.tufts.pro DNS at the EC2 endpoint. Use the server's existing certificate workflow to obtain a certificate for this hostname; prefer DNS validation if avoiding live Nginx changes. The example assumes /etc/letsencrypt/live/messaging.tufts.pro/{fullchain.pem,privkey.pem}; adjust to real certificate paths before enabling. Do not enable a TLS config with missing certificate files.

Save the new server blocks from host-nginx.conf.example in a new site file matching the existing Nginx layout. Do not overwrite existing sites, global config, or certificates. Confirm no current site already claims this hostname. If APP_PORT changed, update the example's proxy port as well.

After staging that one site and checking existing application health, use:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

Nginx reload starts workers with the new configuration and gracefully retires old workers. It is a shared change, so verify every critical application immediately afterward. No guaranteed zero-risk rollout exists on a shared host. Do not restart Nginx. Public EC2 ports remain the existing HTTP/HTTPS ports; do not open 18080, 8000, 8081, or PostgreSQL to the Internet.

Verify web login/logout, native Cognito return, public chat, private DM membership/history/live delivery, and background reconnect. Anonymous public writes currently lack rate limiting; review access controls before broader distribution.

## Updates, rollback, and backups

Save the previous image archive/tags before replacing images. Back up the database before schema changes. Deploy images with up -d --no-build; when the API container changes, also restart web so its Nginx resolves the new API container IP. API restarts invalidate sessions and clients reconnect.

To stop only this app:

```sh
sudo docker compose --env-file deploy/ec2.env stop
```

To undo public routing, remove only the newly enabled messaging site, test Nginx, then reload it. Do not delete shared configuration or run system-wide Docker prune. Never use down --volumes unless intentionally deleting this project's database. Compose volumes survive normal down, but they are not backups.

A logical backup of this project on EC2:

```sh
umask 077
mkdir -p backups
sudo docker compose --env-file deploy/ec2.env exec -T db sh -c 'exec pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "backups/campus-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Store backups off-instance privately and test restoring to a separate database. Rollback after a schema migration may need a restored backup, rather than just previous images.

## References

- [Docker Compose startup ordering and health checks](https://docs.docker.com/compose/how-tos/startup-order/)
- [uv Docker integration](https://docs.astral.sh/uv/guides/integration/docker/)
- [Nginx graceful configuration reload](https://nginx.org/en/docs/control.html)

## Local validation

Validated on the Mac with linux/arm64 images:

- Compose configuration validation; both API and web Docker builds.
- Frontend lint, typecheck, 12 tests, and production web export.
- Backend 12 tests and Ruff.
- PostgreSQL 17 fresh database migrations through 441d5178d7b4.
- API database/HTTP container healthchecks and host loopback-only web binding.
- Static root and /auth/callback, API health and auth config routes.
- Approved browser-origin CORS and rejection of an unrelated origin.
- Persisted public message and live SSE smoke test through container Nginx.
- Custom-format pg_dump and pg_restore into a second isolated database; message retained.

The temporary campus-ec2demo-check containers/networks were removed. Its test-only volume remains; production/source databases were not accessed. ## Server validation and remaining checks

- Verified linux/arm64 images and transfer checksums on EC2.
- Restored a fresh PostgreSQL 17 backup; imported 3 users, 17 total messages, 2 conversations, 4 memberships, and Alembic revision 441d5178d7b4. The migration service completed with no schema changes. Source database remained intact; subsequent source writes are not automatically synchronized.
- API/database healthy on loopback port 18080; only web publishes that host port.
- Obtained a separate messaging.tufts.pro certificate via Certbot webroot, expiring January 10, 2027. HTTP ACME challenge path remains available; other HTTP requests redirect to HTTPS.
- Added a renewal deploy hook scoped to this certificate to test/reload Nginx when renewed. Certbot reported scheduled renewal enabled, and a certificate-specific renewal dry run passed using --no-random-sleep-on-renew.
- Verified existing Nginx file checksums after the new site was added. Existing fishcastwdw.tufts.me, helloworld.tufts.me, mail.tufts.me, and mail.tufts.pro returned HTTP 200 afterward. No failed systemd units were reported.
- Browser displayed imported public history and Live connection. Public HTTPS API health/history, static callback, redirects, and SSE were checked.
- At the initial steady-state check, messaging database/API/web memory usage was approximately 42/79/8 MiB; host had 1.8 GiB available. These are idle observations, not a load test.

Real account sign-in, private conversation delivery, and native use of the deployed API still need user verification. The user added the new Cognito callback; provider acceptance is verified in the deployment checks.

For server maintenance, use sudo docker compose --env-file deploy/ec2.env from /home/ubuntu/apps/ec2demo. Database backup and image archive are private files there. Before updates, preserve the existing database volume and back it up. Source frontend/backend code is on the Mac; EC2 currently runs prebuilt images rather than a build checkout.

## Automated updates

To redeploy updated local source to the existing EC2 app, run `./scripts/deploy-ec2.sh --dry-run`, then `./scripts/deploy-ec2.sh` from groupdemo (add `--migrate` for the first group-chat release). See [the redeployment guide](REDEPLOY.md) for setup, backups, migrations, and recovery.
