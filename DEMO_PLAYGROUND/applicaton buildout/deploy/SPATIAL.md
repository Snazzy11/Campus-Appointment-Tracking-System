# Production campus search and routing

The production API originally had `GEO_DATA_ENABLED=false`, no spatial URL, and
routing disabled. Street tiles alone cannot provide the building directory or
campus path graph.

On October 14, 2026, the separate `campus-ec2demo-spatial` Compose project was
bootstrapped on the existing host. Its `spatial-data` volume contains a PostGIS/pgRouting
database populated from the public campus OSM extract captured October 13 at
20:51 UTC: 485 buildings, 3,910 graph nodes and 4,321 edges. The API's read-only
credential connects through `campus-ec2demo_application`; there is no public database
port. The messaging database and host Nginx were unchanged. API/web were recreated
to load the new environment. Pearce search and Robinson Hall → Pearce Hall routing
were verified through public HTTPS (668.8 m).

Future ordinary app deployments preserve this independent service and use the
`GEO_DATABASE_URL`, `GEO_DATA_ENABLED`, and `GEO_ROUTING_ENABLED` already saved in
server `deploy/ec2.env`. Report writing remains disabled pending a separate writer
credential and production moderator setup. No local users, messages, report data,
or local administrator assignments were copied.

## One-time bootstrap on another existing deployment

Review the target in private `deploy/deploy-settings.json`, then run:

```sh
python3 scripts/setup-spatial-ec2.py \
  --snapshot backend/.data/geospatial/cmu-campus-20261013.osm \
  --captured-at 2026-10-13T20:51:00Z
```

Use the actual retrieval timestamp of your source extract. The ignored snapshot is
not in Git; obtain a campus extract using the geospatial documentation. Do not copy
local test credentials or layer `compose.spatial.yaml` over the messaging stack.

The command builds architecture-matched images locally, uploads a checksummed
bundle, creates independent random database credentials, starts a memory-limited
spatial container, applies geographic migrations, imports the source and graph,
grants the API SELECT-only access, and verifies Pearce plus the graph before activation.
It then backs up the existing app environment, sets only geographic variables, and
recreates API/web. An activation failure restores the old environment. It never
changes/migrates the messaging database or exposes a new host port.

Bootstrap files are in `/home/ubuntu/apps/ec2demo/deploy/spatial-bootstrap` and are
private. `COMPLETE` prevents reinitialization. Do not delete it to perform a data
refresh: future spatial imports and migrations require a separate reviewed backup
and update. `spatial.env` contains operator/reader secrets; keep it off Git and out
of shared logs. Treat `ec2.env.before-spatial` as a private backup too.

For backup, from that directory on EC2:

```sh
umask 077
sudo docker compose -p campus-ec2demo-spatial --env-file spatial.env -f compose.yaml \
  exec -T spatial pg_dump -U spatial -d campus_spatial --format=custom --no-owner --no-acl \
  > spatial-backup.dump
```

Copy backups off-instance privately. No automatic backup schedule is installed.
OSM geometry remains incomplete in some areas; imported paths are not surveyed or
verified accessible routes. Review rejected multipolygons and graph disconnections
before claiming complete campus coverage.
