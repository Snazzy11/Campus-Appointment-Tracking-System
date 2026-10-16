# Explicit spatial migrations and isolated development database

Stage 2 keeps geo in its own PostgreSQL schema, but uses a separate explicit Alembic configuration/version table and GEO_DATABASE_URL. The messaging migration chain still ends at d8b4a21e653c; ordinary app/deployment startup never installs extensions. This revises the earlier proposal to attach a mandatory geographic revision to that chain: current populated PostgreSQL images lack the extension packages, so doing that would break existing deployments.

Local development uses a separate ARM-native PostgreSQL 17 container, localhost:5435, 512MB cap, own project/volume. No messaging volume is mounted. A future supported production database can host both schemas, or a separate spatial database can remain configured. Cloud topology and credentials require a reviewed deployment plan. No production change is made here.

Typed buildings/entrances/paths/intersections/landmarks are views over one spatial feature table, constrained by kind and geometry type. This gives every entity stable identity and shared provenance/verification without duplicated import logic. Parameterized SQLAlchemy Core SQL uses PostGIS directly; GeoAlchemy2 was evaluated but adds no needed capability to this bounded read/import surface and is not added.

Source geometry/name/tags are retained. Append-only operator verification records can override geometry/name/tags; incremental imports update only newer OSM versions and never alter verification records. Missing snapshot objects are retained, not silently deleted. Shared OSM nodes are candidate intersections only; geometry crossings never create routing edges.

HTTP endpoints are public read-only geographic data, with no user identity/location fields or write endpoints. GEO_DATA_ENABLED defaults false. Connections use read-only transactions, bounded result counts and campus bbox, and a 3-second statement timeout. Production should additionally use a SELECT-only database role. The offline CLI uses a distinct operator credential and explicit URL; no HTTP moderator privilege is inferred.
