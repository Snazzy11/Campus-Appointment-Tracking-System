# Stage 2 — Campus geographic data

Implemented locally, 2026-10-13. No EC2 deployment or modification of existing messaging databases. Frontend has no new visible behavior in this stage; Stage 3 connects building search/details to these APIs. Native map verification remains externally blocked.

## Plan and acceptance

Build an isolated ARM PostgreSQL 17 image with PostGIS and pgRouting; add geo entities, provenance, verification overrides, bounded public reads, repeatable OSM consumption and quality reports. Gate with actual PostGIS integration tests and messaging/frontend/deployment regressions, then final browser pass. Acceptance: additive migration preserves public records; populated rollback refuses; same input changes zero rows; newer source versions preserve verified overrides; SRID/type/campus boundary constraints hold; only candidate OSM nodes connect paths; no HTTP write surface; defaults disabled.

## Implementation and files

- compose.spatial.yaml, deploy/spatial/Dockerfile, deploy/spatial/local-reader.sql: separate localhost:5435 database/volume/project, 512MB cap, ARM-native packages; local SELECT-only reader.
- backend/geo-alembic.ini and geo_migrations/{env.py,versions/geo001_features.py}: explicit standalone migration/version table. Decision: ../decisions/0002-spatial-migrations.md.
- backend/app/geospatial/{database.py,importer.py,queries.py}: bounded read-only API connections, JSON/XML import, quality checks.
- backend/app/routers/geographic.py and app/main.py: public feature/building/detail/entrance/landmark reads. No user location or identity data.
- backend/scripts/campus_data.py, backend/spatial_tests/test_spatial.py, backend/.env.example: operator tool, 12 real spatial tests, opt-in configuration.
- cmu-campus.overpass: reusable campus query. Source extract is backend/.data/geospatial/cmu-campus-20261013.osm (ignored). Import/reimport/quality/HTTP artifacts: ../testing/stage-2-*.json.

No new Python/frontend dependency or native API is introduced. SQLAlchemy Core executes parameterized PostGIS SQL; GeoAlchemy2 is not needed for this surface.

## Schema and data

geo.sources tracks original SHA256, HTTPS origin, captured/imported timestamps, ODbL license and attribution. geo.features is a constrained entity table with typed views buildings, entrances, paths, intersections, landmarks; geo.verifications stores operator identity, reason, timestamp and independent geometry/name/tag overrides. WGS84 longitude/latitude, SRID4326, 2D, valid/nonempty type constraints and campus study extent (-84.80,43.56,-84.74,43.62). GiST source geometry and feature-kind indexes; verification lookup index. Distances use geography meters. Querying effective overrides can require scanning the small campus set; large/regional deployment needs an indexed materialized effective geometry strategy and fresh EXPLAIN measurements.

Actual small campus core OSM extract: 485 buildings, 57 entrances, 1,016 paths, 1,072 candidate intersections, 3 landmarks. Study extent includes nearby non-campus features; no claim every imported building is CMU-owned. Five source records were rejected with reasons, including unsupported relation assembly/out-of-bound ways. Multipolygon building relations are flagged for review, not fabricated. Coverage is a core extract, not a complete campus inventory.

Quality report: 328 unnamed buildings; 464 without a mapped entrance within 3m; 1,073 entrance/path records without wheelchair tags; 6 paths without shared-node connectivity; zero invalid accepted buildings, duplicate paths or unexpected crossings in this extract. OSM is not authoritative. Three-meter entrance association is unverified proximity, and shared nodes are candidates only. Neither geometric crossings nor this stage create a routing graph. An override record means a field was reviewed, not that the feature has verified wheelchair access.

## Exact checks and results

Run from the active app root unless noted:

```sh
docker compose -f compose.spatial.yaml build
docker compose -f compose.spatial.yaml up -d --wait
docker compose -f compose.spatial.yaml exec -T db createdb -U spatial campus_spatial_test
# backend working directory; explicit local operator URL
export GEO_DATABASE_URL='postgresql+psycopg://spatial:local-spatial-test-only@127.0.0.1:5435/campus_spatial'
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked alembic -c geo-alembic.ini upgrade head
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked python -m scripts.campus_data import --snapshot .data/geospatial/cmu-campus-20261013.osm --captured-at 2026-10-13T20:51:00Z --source-url 'https://api.openstreetmap.org/api/0.6/map?bbox=-84.787,43.578,-84.764,43.598'
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked python -m scripts.campus_data validate
SPATIAL_TEST_URL='postgresql+psycopg://spatial:local-spatial-test-only@127.0.0.1:5435/campus_spatial_test' UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q spatial_tests
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked ruff check .
# frontend working directory
npm run lint && npm run typecheck && npm test
# app root
python3 -m unittest discover -s scripts/tests -q
```

Image verified aarch64, PostgreSQL17.11, PostGIS3.6 (package3.6.4), pgRouting4.0.1. Integration: 12 passed (idempotency, stale versions, provenance, overrides/geometry, boundary/type/SRID validation, duplicate reports, candidate connectivity/crossings, public reads/no writes, disabled API, XML entity rejection, rollback guard/empty rollback/public-table sentinel). Existing backend51, frontend34, deployment8 passed; lint/typecheck/Ruff passed. Known Starlette testclient deprecation remains. A transient early development migration cleanup failed because the just-added override function did not exist in the earlier empty test schema; cleanup made tolerant and full upgrade/downgrade tests reran successfully. No populated messaging schema was affected.

Repeat real import: changed=0. Live API smoke used SELECT-only reader, HTTP200. Cold building response485 features/349KB in97ms; paths first500/322KB in117ms; landmarks3/1.7KB in7ms. These are local single-request measurements, not production/load guarantees. HTTP capped500, cursor pagination, finite ordered campus bbox, bigint bounds, read-only transaction, 3s statement timeout, pool2+overflow1. No HTTP imports/verifications or broad authorization changes. Existing framework advisories from Stage1 remain a later hardening gate.

## Sources and operational use

Overpass requests were HTTP406 or timed out; one bounded direct OSM API extract succeeded. Repeat development can consume that stored snapshot offline; routine larger/periodic imports should use licensed extracts or Overpass, not repeatedly burden the editing API. Raw contributor usernames/UIDs are not stored in geographic tables or exposed by APIs.

- [OSM API documentation](https://wiki.openstreetmap.org/wiki/API_v0.6)
- [OSM license/attribution](https://www.openstreetmap.org/copyright)
- [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [PostGIS GeoJSON](https://postgis.net/docs/ST_GeomFromGeoJSON.html)
- [pgRouting source/install/license](https://github.com/pgRouting/pgrouting)
- [PostgreSQL Debian ARM package support](https://www.postgresql.org/download/linux/debian/)

ODbL applies to imported data; retain attribution and evaluate share-alike obligations when distributing adapted databases. PostgreSQL permissive, PostGIS/pgRouting GPL components remain server extensions; exact build package versions should be revalidated and pinned by image digest for a production release.

API opt-in: GEO_DATA_ENABLED=true and GEO_DATABASE_URL using a SELECT-only account. Apply deploy/spatial/local-reader.sql after migration for local development. API is disabled by default; no mapping DB variables are automatically added to production Compose/deploy. URL passwords in this document are localhost development-only. Use distinct managed secrets/operator roles in production.

Back up with pg_dump custom format before imports/migrations, including public plus geo when sharing a DB; preserve raw snapshot and SHA. Import is one transaction, only newer OSM versions update, verified overrides remain independent; missing objects retained, no deletion inferred from a partial bbox. Delete/retire and full replication-diff support require a deliberate future policy. Downgrade refuses any geographic data; recover by restoring into a new database and validating it before switching the explicit URL. Never delete data to force downgrade. No existing cloud database image is replaced by these files. Local stop: docker compose -f compose.spatial.yaml stop (keep volume; never use down -v on valuable data).

## Final verification and next stage

Documentation and automated checks precede the final browser pass. Results are appended in ../testing/stage-2-devices.json. Existing Map tab is unchanged and still uses provider tiles; imported data is not yet drawn on it. iOS simulator availability check still fails CoreSimulator/XPC; no Android/native runtime claim. Stage3: database-backed building search/details and map feature selection, then Stage4 verified pedestrian graph/routing.
