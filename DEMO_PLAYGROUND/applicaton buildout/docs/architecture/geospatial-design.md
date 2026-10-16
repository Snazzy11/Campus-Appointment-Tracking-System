# Geospatial architecture and staged design

Status: proposed architecture, not a claim that routing/data/reporting exist.

## Integration

Keep Expo Router Maps destination and existing FastAPI application. Web renderer: MapLibre GL JS in a platform-specific component, lazy-loaded after mounting so static export remains safe. Native renderer: MapLibre React Native v11, which supports the new architecture and requires rebuilding the Expo development client. Shared configuration/view state and GeoJSON APIs; do not pass GL JS into React Native directly. Retain camera and overlay state when a basemap changes. Feature flags default off until configured.

Provider: configurable, licensed MapTiler street/satellite/hybrid styles with a restricted public key; custom provider style URLs are an alternative. No provider account/key is presently available. Public keys ship in JS and must be restricted at the provider; secrets do not belong in EXPO_PUBLIC variables. Attribute OSM and imagery sources as required by returned styles/licenses. No bulk tile prefetch or offline tile caching by default.

## Spatial database and provenance

Plan geographic schema geo with buildings, entrances, landmarks, path edges/nodes, source snapshots, verification/override records. GeoJSON uses longitude/latitude and SRID 4326; length/distance use geography or a documented suitable projection. GiST geometry indexes and bounded bbox queries; validated type/SRID/coordinate limits. Retain OSM IDs, version/import timestamps/license and source geometry separately from verified overrides. Incremental import must be idempotent and must not overwrite manual verification. Validate geometry, duplicates, connectivity and accessibility fields.

Stage 2 first provisions an isolated PostgreSQL 17 spatial test image on ARM, never swaps the populated cloud database blindly. GeoAlchemy2 is evaluated at that stage; no GIS dependency is needed for the audit. Existing Alembic revision is the parent of additive migrations. Downgrade must refuse destructive removal of geographic records without an explicit recovery procedure.

## Routing and reports

Campus-controlled pgRouting graph, deliberately connected at verified pedestrian junctions; crossing geometry alone is insufficient. Standard, shortest and step-free profiles. Stairs/restrictions/verified closures excluded where required; unknown slope/surface information produces confidence warnings, not wheelchair-accessibility guarantees. Preserve graph/source versions in route responses. Valhalla is a comparison only until an operational need for a second engine is established.

Blips: authenticated authors, extensible categories, point-first geometry, moderation transitions and expiry. Only authorized verified reports affect routing. Explicit moderator/admin grants and audit trail, bounded inputs and rate limits. Derive active closures transactionally; ordinary nearby markers do not close paths.

Real time: snapshots plus versioned changes, idempotent event application, reconnect recovery. Evaluate PostgreSQL LISTEN/NOTIFY as notification transport with persisted event/outbox data; NOTIFY itself is not durable replay. Shared transport must be verified across workers along with session storage.

## Later stages

On-demand location permission, no continuous location upload by default; accessible destination lists and textual route instructions alongside map. Only licensed metadata/routes may be cached; no offline routing promise without a local graph/algorithm. 3D extrusion uses actual height provenance or clearly labeled inference, reduced motion, GPU cleanup and 2D fallback. Gaussian splats remain blocked until a licensed, georeferenced campus asset exists; do not fabricate a scene.

## Gates

Follow the supplied ten-stage order. Every stage records plan, acceptance, tests, regression, security/performance and documentation BEFORE its final viewport/native verification. Fixes discovered in that pass require rerunning earlier affected gates, then another final device pass. Missing keys/native hardware/spatial services remain explicit unverified dependencies.

## Official references reviewed 2026-10-13

- https://docs.expo.dev/versions/v57.0.0/
- https://maplibre.org/maplibre-gl-js/docs/
- https://maplibre.org/maplibre-react-native/docs/setup/getting-started/
- https://maplibre.org/maplibre-react-native/docs/setup/expo/
- https://docs.maptiler.com/cloud/api/maps/
- https://operations.osmfoundation.org/policies/tiles/
- https://github.com/postgis/docker-postgis (published images documented amd64; ARM needs separate validated build)
- https://github.com/pgRouting/docker-pgrouting
- https://www.cmich.edu/campus-locations (Mount Pleasant main campus address)

Dependency versions/licenses/advisories must be checked again when each package is introduced; this research does not imply approval or installation of every listed technology.
