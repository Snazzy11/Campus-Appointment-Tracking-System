# Stage 1 follow-up — OpenFreeMap street maps

## Plan and revised acceptance

The user chose free hosted street maps and deferred offline mapping as nonessential. Configure the existing web/native renderers with OpenFreeMap Liberty, preserve API settings, verify actual CMU coverage and attribution, rerun regression/build checks, document results, then execute the final responsive/native pass. Satellite and hybrid are deferred: the original three-basemap criterion is no longer part of this street-first follow-up. No database changes or deployment.

## Files changed

Private frontend/.env (not committed), frontend/.env.maps.example, frontend/tests/maps.test.mjs, docs/geospatial/PROVIDER-SETUP.md, docs/geospatial/STATUS.md and this report. Renderer infrastructure and authentication remain unchanged.

## Tests and results

Commands: npm run lint; npm run typecheck; npm test; npx expo export --platform all --clear --output-dir /private/tmp/campus-openfreemap; UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q; UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked ruff check .; python3 -m unittest discover -s scripts/tests -q. Results and final device evidence are recorded in ../testing/stage-1-openfreemap-devices.json after the final pass. Exports are not native binary/device verification.

## Security/performance and regression

Public HTTPS tiles and styles, no API credentials, no precise device-location requests or uploads, no offline downloads. Existing MapLibre self-hosted worker/version and attribution controls are retained. No EC2 tile-generation workload introduced. Existing framework dependency advisories remain documented in dependency-audit.json; no unrelated forced upgrades. Existing SQLite/mocked-Cognito test coverage does not prove all physical-device or real-account flows.

## Final device verification and limits

Final pass runs last against the configured source, including nine web sizes and available native tooling. Record actual map coverage/attribution, controls, tabs, orientation/resize and failures. Missing native binary/SDK/device availability is unverified, not a browser equivalent. Native renderer uses the same documented OpenFreeMap style but must still be validated on a rebuilt app. No guarantee of accessible routes or university-authoritative map data.

Next: satisfy remaining native verification, then isolated ARM-compatible PostGIS/pgRouting work (Stage 2). Building data, routing and reports are not supplied by the basemap.


Ordinary gate results: 51 backend tests, 34 frontend tests and eight deployment tests passed; Ruff, Expo lint and TypeScript passed. All platform exports passed. Native availability check `xcrun devicectl list devices` failed with invalidated XPC connection and timed out waiting for CoreDeviceService initialization. Prior simulator access failed and adb is absent; no native build/device result is claimed. Final browser/device evidence is collected after this documentation update.
