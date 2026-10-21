# Stage 4 — Pedestrian routing

## Implementation plan and acceptance

Build a reproducible PostGIS/pgRouting graph from consecutive OSM nodes, preserving shared-node topology. Reject missing/mismatched source nodes; never join geometric crossings. Keep operator closures separate from generated graph data. Invalidate the graph when path/entrance source or review data changes. Bound public POST route requests and avoid recording coordinates in URL logs.

Support walking, shortest distance, and step-free profiles; restrictions and closures exclude edges. Unknown accessibility remains explicit. Building endpoints use mapped entrances, never centroids; coordinate and entrance snapping is bounded and disclosed. Provide origin selection, route drawing, clear/recalculate, time/distance, textual path summary and graceful no-route states on web/native.

Acceptance: real PostGIS deterministic fixtures verify connectivity, restrictions, closures, stairs, cost, geometry, disconnected routes, snapping, same endpoints, validation and migration safety. Run frontend state tests, existing regressions, lint/typecheck and exports. Document performance and data limitations, then perform final responsive/device verification last. No cloud rollout.

Implementation and validation results will be appended after execution. This document does not claim completion.

## Implemented behavior and data

`geo003` adds `geo.routing_state`, `routing_nodes`, `routing_edges`, and operator-managed `path_closures`. It follows the separate geographic migration chain; public messaging tables/migrations are unchanged. Local graph: 3,910 source nodes, 4,321 consecutive-node segments, nine components before restrictions, no rejected paths from the existing core snapshot. This does not constitute a campus survey. Five previously rejected complex building relations, unnamed buildings, parking lot ingestion and broader data correction remain deferred GIS work.

Graph rebuilding requires the original bounded OSM snapshot. Every way version, node ID sequence and coordinate must agree with the stored source geometry. Missing/mismatched ways or changed geometry overrides are excluded for review, not bridged. Consecutive original OSM node IDs define connections; coincident coordinates and geometric crossings do not connect. Source node barriers/access tags are retained. Reviewed entrance access tags apply to through paths too; moved entrances block the original node pending topology review. Pedestrian areas require a mapped centerline. Shared nodes across bridge/level tags are still source assertions, not independently verified crossing surveys.

Graph replacement is atomic and serialized against imports/reviews. Source/review changes mark it dirty and requests return503 until an explicit rebuild. Closures survive rebuilds, are effective between starts_at and ends_at (null is indefinite), and apply at request time. Rebuilds regenerate edge IDs; closures and response path IDs refer to stable feature IDs. Downgrade refuses retained closure records. Other spatial rollback guards still protect source/review data. Extensions are retained. Restore backups to a separate database; never remove reviews or closures to force a rollback.

Routing uses installed pgRouting4.0.1 `pgr_dijkstra` with a bounded 8x8 origin/destination entrance matrix. Profile `shortest` minimizes meters; `walking` and `step_free` minimize estimated duration. Default speed1.3m/s, stairs multiplier2, rough surface multiplier1.4, reviewed absolute percent slope factor `1 + min(abs(slope)/100,1)*4`. Configurable backend settings have finite bounds: GEO_WALK_SPEED_MPS0.3–3, GEO_STAIRS_FACTOR1–10, GEO_ROUGH_FACTOR1–10, GEO_SLOPE_FACTOR0–20. Estimates are not measured travel times.

Access restrictions, conditional/time-dependent access (not interpreted yet), closed paths, indoor segments and unsupported barriers are excluded. Pedestrian one-way tags control directed traversal; generic vehicle one-way tags do not. Foot permission takes precedence over generic access. Step-free additionally excludes mapped stairs, known wheelchair restrictions, raised/rolled curbs, selected unsuitable surfaces and reviewed slopes above8.33%. Unknown surfaces/slopes/curbs remain possible and always carry an accessibility warning. `path_accessibility_verified` covers reviewed path segments only; it never verifies a complete wheelchair route or the endpoint connections. No accessible-route guarantee is made.

Buildings resolve to nearby mapped entrances within3m or reviewed associations. Buildings with more than8 candidates require entrance selection; no building centroid connector is fabricated. Coordinates snap to the nearest eligible source node within25m; entrances within3m, preferring their exact source-node identity when present. Snapping is to nodes, not line interiors: long sparse segments may give no-route errors even when visually nearby. Returned gaps are disclosed, excluded from length/time, and never drawn as traversable lines. No walking access across an unmapped gap is implied. Same-node routes return a Point geometry and zero distance/time.

Twenty named buildings in the current core extract have usable entrance candidates; nineteen tested routes from Park Library to other named buildings succeeded. This is a limited coverage check, not proof that all campus destinations are routable. Current centerline coverage includes imported footway/pedestrian/path/steps; shared-use paths encoded as other highway types need reviewed import expansion.

## API and UI

POST `/api/geo/routes` accepts `{origin, destination, profile}`. Each endpoint is `{kind:"building"|"entrance",id}` or `{kind:"coordinate",longitude,latitude}` within the study bounds. Profile is walking (default), shortest or step_free. Unknown fields, invalid IDs/coordinates/profile return422. Missing feature404; no usable connection/disconnected route422; disabled/stale/unavailable geographic service503. A recalculation repeats the request with current inputs/closures. Alternatives are not implemented.

The response is a GeoJSON Feature with LineString (or same-node Point), bounds, distance_m, duration_s, path_ids, profile, path summary, endpoint snaps/gaps, graph_built_at, confidence, verification flag, warnings, license and attribution. Text summaries follow ordered mapped paths; they are not turn-by-turn maneuvers, spoken navigation or continuous GPS tracking.

UI: search/select a building, press Use as start, search/select a destination and press Get directions. Entrance selection can refine either endpoint. Walking/Shortest/Step-free buttons clear stale results when changed. Recalculate uses latest closures; Clear route preserves choices. Reset start removes the origin. Show building / selecting an entrance clears the route and focuses the destination. Purple line/finish marker and green start marker persist across basemap reloads. Route bounds refit on resizing; selectable text summaries provide a non-map representation.

Use my location requests a single foreground position only after a tap. Out-of-campus, denied, accuracy worse than50m, missing accuracy and timeout cases have messages; buildings remain an alternative. Origin coordinates live in component memory and travel to our route service only when directions are requested. They are not saved to accounts, local storage, or background tasks. Input changes/cancellation/unmount invalidate late results; routes time out after12s and location after15s. A native location acquisition may finish after UI cancellation, but its result is ignored; no watch/background task is started. Expo Location57 was installed with Expo's SDK-compatible installer; native binaries must be rebuilt for the module/config.

## Security and configuration

`GEO_ROUTING_ENABLED=false` by default, additionally requiring GEO_DATA_ENABLED and a spatial URL. Local private backend configuration enables it; cloud remains unchanged. Public campus route reads need no account and use a SELECT-only role, repeatable-read transaction snapshot, three-second statement timeout, pool size2+1 overflow and five-second pool wait. Request bodies keep coordinates out of ordinary access-log URLs. Database failures return a generic503 without SQL parameter disclosure. Route metrics contain profile, segment count and latency only. No route persistence or third-party routing provider is used. Same-origin hosting is preferred; the existing CORS allowlist is unchanged. Dedicated rate limiting and multi-worker deployment remain Stage10 hardening dependencies; do not enable a public rollout on this local test evidence alone.

## Commands and verification

From backend, with a local operator URL explicitly provided:

```sh
GEO_DATABASE_URL="$OPERATOR_GEO_URL" uv run --locked alembic -c geo-alembic.ini upgrade head
GEO_DATABASE_URL="$OPERATOR_GEO_URL" uv run --locked python -m scripts.campus_data build-graph --snapshot .data/geospatial/cmu-campus-20261013.osm --captured-at 2026-10-13T20:51:00Z
SPATIAL_TEST_URL='postgresql+psycopg://spatial:local-spatial-test-only@127.0.0.1:5435/campus_spatial_test' UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q spatial_tests
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked ruff check .
```

From frontend: `npm run typecheck`, `npm run lint`, `npm test`; `EXPO_PUBLIC_API_URL=http://127.0.0.1:18090 EXPO_OFFLINE=1 npx expo export --clear --platform all --output-dir /private/tmp/campus-stage4`. The --clear flag matters when changing inlined Expo API origins. From app root: `python3 -m unittest discover -s scripts/tests -q`, `git diff --check`.

Automated results before final device pass:34 real PostGIS tests,51 existing backend tests,46 frontend tests and8 deployment tests passed. Lint/typecheck/Ruff passed. All-platform JavaScript exports passed (native binary verification is separate). Initial old migration test expected geo002; updated to geo003, its transactional rollback protection still passes. The new tests cover cost/distance/geometry, stairs, restrictions, barriers, directed edges, closure expiry/rebuild survival, building/entrance endpoints, unknown data, exact-node same endpoints, invalid bounds, disconnected topology, source mismatch, API flags, rollback preservation, stale responses/deadlines, location validation and denial. Existing messaging/auth/profile suites remain intact.

Initial 19 campus routes measured75–157ms locally. The recorded reader-backed HTTP sample/graph information is `../testing/stage-4-http.json`; these are single-client samples, not production load tests. Existing dependency advisories (29:10 moderate/19 high) and Starlette test-client deprecation remain; no forced framework upgrade was attempted.

Exploratory browser testing exposed cross-origin POST failures in this preview browser and an inlined old API URL retained in Metro's cache. The final preview serves the static export and API together at http://127.0.0.1:18090/maps with a cache-cleared build and verified origin. CORS settings were not weakened. Ordinary8000 dev API and production remain untouched. A separate temporary preview wrapper serves export HTML routes; this is not a production deployment recipe. The final responsive/native report is `../testing/stage-4-devices.json`; native runtime/location prompts remain unverified until supported hardware/services and a rebuilt app are available.

## Files / references / next stage

Backend: `geo003_routing.py`, `app/geospatial/graph.py`, `routing.py`, `database.py`, `routers/geographic.py`, operator CLI, routing spatial tests and updated migration assertion. Frontend maps: routing controller/hook/panel, destination integration, web/native camera bounds, vector layers; Expo Location package/lock/config; routing tests. README, status, stage report and test artifacts updated.

Official [Expo57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [Expo57 reference](https://docs.expo.dev/versions/v57.0.0/), [RN0.86 Pressable](https://reactnative.dev/docs/0.86/pressable), and [PostGIS line location](https://postgis.net/docs/ST_LineLocatePoint.html) were reviewed. pgRouting documentation endpoints returned403/unavailable; installed4.0.1 functions were exercised directly in real database tests. No line-interior snapping implementation is claimed.

Next planned stage: moderated map reports/blips. GIS data correction and native runtime verification remain open dependencies, including missing buildings/entrances and parking-lot data.

## Follow-up — explicit From/To and browser location

Replaced the implicit Use as start workflow with separately labeled From and To autocomplete inputs. Each can be edited/cleared independently and supports keyboard suggestions. Editing From immediately invalidates the old origin/route; late search or location results cannot restore it. Get directions requires both selected endpoints. Origin building selection lets the backend choose a usable mapped entrance; destination entrance controls remain below. The complete panel scrolls on small screens so suggestions and controls remain reachable. No database/API changes.

The installed Expo web permission helper may acquire a location to request permission, followed by a second high-accuracy acquisition in the previous flow. That is a plausible timeout contributor, not a diagnosis of this Mac's OS permissions/provider. Web now calls navigator.geolocation.getCurrentPosition once, allowing its own permission prompt, standard accuracy, maximumAge30s and timeout20s. The controller has a30s safety deadline (including permission time), cancellation/stale-response protection, and retains campus/50m accuracy validation. Native retains the Expo foreground-only acquisition. Denial, unavailable provider, insecure origin, absent API, timeout, inaccurate position and outside-campus results are distinguished. macOS/browser permission or unavailable positioning can still prevent location; the app cannot promise a successful fix for device services. No precise user location was collected during validation.

Validation: frontend typecheck/lint and49 tests passed, including one-shot browser location options and all failure codes; all-platform export and final responsive UI results are recorded in `../testing/from-to-devices.json`. Prior native service/tooling blockers remain; JS export is not native runtime validation. Manual repro: select Park Library in From, Bovee in To, then Get directions. Change or clear From and verify To remains intact and old route disappears.

## Follow-up: missing entrance tags and destination-first directions (2026-10-13)

Building routing now falls back, only when no tagged entrances exist, to existing graph dead ends within one meter of the effective building boundary. The result labels these as mapped approaches, explicitly warns that they are not verified entrances, and retains access, closure and profile restrictions. No artificial road crossing or connector is created. Endpoint errors identify From or To. Robinson → Pearce is 668.8 m; 24 pairs (that pair plus 23 SAC destinations) passed all three profiles, 72 routes total; see ../testing/routing-coverage.json.

The initial UI shows To only. Get directions reveals From, requests current location when no starting point exists, and calculates on successful location acquisition. A manually chosen start takes priority; late GPS responses cannot overwrite it or trigger a stale route. Permission denial, timeout and off-campus location leave From editable.

Generate a read-only GIS review inventory with:
```sh
# From backend/, with GEO_DATABASE_URL set to the spatial database:
uv run --locked python -m scripts.campus_data entrance-candidates > entrance-candidates.geojson
```
The current inventory is ../testing/entrance-candidates.geojson (59 candidates). Load it in QGIS with the campus footprints and walkways. Candidates exclude already mapped entrances within 3 m and never assert public access or accessibility. Source attribution: © OpenStreetMap contributors, ODbL.

Before confirming a candidate, record an authoritative campus GIS source or an on-site observation, door position, access restrictions, reviewer and date. Existing mapped entrances can be corrected with the existing geo.verifications overrides and associated using geo.building_entrances; those independent records survive newer source imports. The candidate export does not promote path endpoints to verified entrance records. New surveyed doors need a reviewed local-feature import workflow; no survey or authoritative entrance dataset was supplied in this task.

Validation: frontend lint/typecheck and 51 tests; backend and PostGIS suites 88 tests. Regression cases cover boundary tolerance, rejection of through-path nodes, closure rejection, location failure and manual edits during location acquisition. Web export succeeds. Actual location acquisition and native-device behavior remain unverified.
