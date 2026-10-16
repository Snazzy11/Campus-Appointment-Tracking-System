# Stage 1 — Map foundation (implemented, not fully verified)

## Plan and acceptance

Add isolated platform renderers to the existing Maps tab. Keep a shared bounded configuration contract, a feature flag, stable map lifecycle and styles, error/retry UI, accessible controls, cleanup and provider documentation. Acceptance requires live street/satellite/hybrid styles switching without camera loss, licensed attribution, and final web/native verification. No provider key exists, so full acceptance remains blocked. Do not advance to spatial migrations on the strength of mock tests alone.

## Implemented and files

- frontend/src/features/maps/config.ts: explicit opt-in flag, HTTPS provider styles and public-key encoding, coordinate order and initial view.
- CampusMap.web.tsx: lazy GL JS loading, a single map instance, controls, keyboard hints, ResizeObserver cleanup, loading/error states and style retry.
- controller.ts: style lifecycle, idempotent disposal, overlay source restoration hook, resize; used by the web renderer.
- CampusMap.tsx: distinct native MapLibre v11 renderer, camera state restoration, load/error/timeout UI, native retry, lazy import and Expo Go unavailable state.
- MapFrame.tsx: labeled modes, disabled unavailable modes, error boundary, accessible state announcements and warnings. No location permission request.
- src/app/(tabs)/maps.tsx: existing destination integration; other tabs/authentication remain intact.
- frontend/.env.maps.example, package.json/package-lock.json and app.json: reproducible configuration, pinned GL JS 6.14.0 (BSD-3-Clause), RN 11.5.0 (MIT), official Expo config plugin. No generated native directories were manually created.
- frontend/Dockerfile, compose.yaml, scripts/deploy_ec2.py: public mapping build inputs, default disabled; normal deploy accepts exported public map variables. No geospatial deployment was run.
- frontend/tests/maps.test.mjs: missing-key/flag, HTTPS validation, mode URLs, lifecycle/style/overlay cleanup and unavailable UI tests.

## Database changes

None. Read-only cloud inspection also confirms postgis/pgrouting packages absent (zero pg_available_extensions rows). Existing database image/volumes were not changed by mapping work.

## Tests and regression

Frontend: npm run lint; npm run typecheck; npm test. Backend: UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q; uv run --locked ruff check . (same cache setting). Deployment: python3 -m unittest discover -s scripts/tests -q; python3 -m py_compile scripts/deploy_ec2.py. Builds: EXPO_PUBLIC_MAPS_ENABLED=false npx expo export --platform all --clear --output-dir /private/tmp/campus-map-final. Developer-only web smoke build uses EXPO_PUBLIC_MAPS_ENABLED=true and EXPO_PUBLIC_MAP_STREET_STYLE=https://demotiles.maplibre.org/style.json with --clear, output /private/tmp/campus-map-qa. Demo tiles are only a renderer test, not a production provider or satellite validation.

Results: 51 backend tests, 33 frontend tests and eight deployment tests pass; lint, Ruff and TypeScript pass; all-platform exports pass. existing baseline tests retain coverage. No real account/browser or physical-device regression claim is made. Final web viewport/native verification is the last activity and recorded in ../testing/stage-1-devices.json. If it finds a defect, fix it, rerun affected gates and repeat that pass.

## Security/performance

No new backend endpoint or location collection. Map URLs come from trusted operator build configuration, not user input; public provider keys must be restricted. HTTPS-only style URLs; no embedded basic-auth credentials. No external map requests while disabled. GL JS renderer is a lazy web chunk (~1.1 MB export artifact) plus stylesheet (~83 KB); native bundle increases to ~2.7/3 MB iOS/Android. These are build sizes, not device latency/memory/battery measurements.

npm audit reports 29 vulnerabilities (10 moderate, 19 high), primarily inherited Expo/RN/Metro toolchain/transitive chains. Native MapLibre is flagged through its Expo/RN dependencies, not a direct MapLibre advisory in this report; GL JS has no listed advisory. Preserve /private/tmp/campus-map-audit.json findings in testing/dependency-audit.json. Do not claim a clean security gate or apply forced major upgrades silently. Resolve framework advisories and validate patched compatible versions before production enablement.

## Known limitations and next stage

No MapTiler account/key yet: actual campus-detail street, satellite and hybrid loading/switching/attribution cannot be validated. Native development binary has not been rebuilt or tested. Expo Go cannot validate MapLibre. Live tile failures/context capabilities and full keyboard/touch coverage depend on final browser results; unsupported rendering shows fallback. Accessibility directions, building lists/search, campus geometries, routes, blips, realtime map data, offline navigation and 3D are not implemented in this foundation. Empty overlay source is an extension seam, not imported geographic data.

Coordinate anchor is the destination in CMU's main-campus directions link: [-84.7756162,43.5906302], initial zoom 14.5. This is a campus view anchor, not a surveyed entrance or routing destination. Source https://www.cmich.edu/campus-locations; official shortlink https://goo.gl/maps/2H37jYB41EjpsWT39 resolves to the destination coordinates. No university endorsement is implied.

Next: finish provider and rebuilt native validation to satisfy Stage 1, then Stage 2 with an isolated ARM-compatible PostgreSQL 17 spatial database and real spatial integration tests. No production database swap is included in this stage.


First final browser pass found the MapLibre 6 worker URL incompatible with Metro's lazy bundle path. Fixed by copying the exact pinned module worker plus BSD license to versioned public assets during install/build, explicitly setting its same-origin URL, and serving .mjs as JavaScript in the container Nginx location. No CDN worker or relaxed CSP requirement is introduced. A worker error now remains visible until retry, even if a subsequent style-load event fires. Worker/license identity and this error race have regression tests. Final device verification is repeated after affected tests/exports and this documentation update.

Worker serving checks: HTTP HEAD http://127.0.0.1:18087/maplibre/6.14.0/maplibre-gl-worker.mjs returned 200 with text/javascript; isolated nginx:1.28-alpine nginx -t with the actual container config and a loopback api host alias passed. These ordinary checks preceded the repeated final browser pass.

The repeated landscape pass found 29px default map controls and an overly tall header. Fixed web zoom targets to 44px, omitted the redundant compass button (keyboard rotation remains), and condensed the shared header/footer on short screens. Earlier gates are rerun before the next final verification pass.

The compact layout waits until client hydration before applying viewport-specific markup, preserving static HTML consistency. The final repeat uses rebuilt demo and disabled exports from the corrected source. Web test measurements check actual viewport sizes, map-control bounds and navigation after orientation changes. Native compilation/device checks remain unverified, rather than inferred from JS exports.
