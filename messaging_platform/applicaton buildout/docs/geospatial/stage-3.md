# Stage 3 — Building search and destination selection

Implemented locally, 2026-10-13. This stage connects the Maps UI to the Stage2 PostGIS data. The production app has not been deployed. Native code exports/typechecks, but device runtime verification remains blocked by unavailable Apple device services and absent Android tooling.

## Plan and acceptance

Add indexed database name/verified-alias search, deterministic ranking, bounded suggestions, building details, footprint highlighting and entrance selection. Share search/destination state between web/native renderers. Keep reviewed building association separate from reviewed accessibility. Test real PostGIS migrations/queries, asynchronous request races, keyboard selection, errors and map overlay lifecycle; run existing regressions and document results before the final cross-device browser pass.

## Behavior

Search starts after two characters and a 250ms debounce, with a 10-second client timeout. Exact matches rank first, then prefixes, then substrings; case is ignored. Ties sort by building name then stable ID, preserving distinct buildings with duplicate names. SQL wildcard characters are treated literally. The top20 suggestions are shown; has_more prompts the user to narrow the query. Empty/single-character queries return no suggestions. No fuzzy guessing or fabricated abbreviations.

Verified alternate names and abbreviations live in geo.building_aliases, with reviewer, source/reason and timestamp. The initial imported dataset has157 named buildings and no reviewed alias records yet. Alias functionality is covered with explicit test fixtures; production aliases require a reliable campus source or review. Unnamed buildings are still addressable via their IDs/details and can be found after a verified alias is added. Search is not an exhaustive campus directory: OSM core coverage and missing metadata from Stage2 remain.

Web supports ArrowUp/ArrowDown, Enter, Escape and normal tab navigation, with combobox/listbox semantics and an active suggestion. Native uses the platform text input, tappable results and submit-to-select; physical keyboard and screen-reader behavior still need device testing. Stale or aborted searches/details cannot replace a newer choice; clear removes selection/highlighting. No location permission is requested.

Selection loads the building and entrances, focuses its bounds and draws a purple footprint with entrance markers. Choosing an entrance focuses that point; Show building on map recenters the footprint. Geometry comes from the database, not basemap label IDs. Resize/style reload preserves the current destination and its overlay. On narrow screens the scrollable inspector occupies at most half the content area; desktop/landscape uses a side panel. Zoom controls remain44px.

Nearby entrances (within3m of footprint) are marked association-unverified. Explicit geo.building_entrances records identify reviewed associations, including entrances outside that proximity threshold. geo.verifications.accessibility_verified is a separate field; an ordinary name/geometry review never turns wheelchair information into a verified claim. Walking directions are explicitly marked coming next; no route is calculated or implied in Stage3.

## Database changes

Explicit spatial revision geo002 follows geo001. Adds pg_trgm, reviewed aliases/entrance links, accessibility verification flag, and geo.building_search_terms. B-tree prefix and GIN trigram indexes cover normalized terms. Triggers refresh terms transactionally when source names, verified names or aliases change; newer OSM imports preserve reviewed aliases/associations. Typed reference triggers reject using an entrance as a building. Migration backfills existing names; default false preserves the meaning of existing verification records.

geo002 downgrade refuses reviewed alias/association/accessibility records. Derived search terms can be rebuilt from source metadata. The messaging migration chain is unchanged. This revision was applied only to local campus_spatial and disposable campus_spatial_test, using the existing isolated ARM container. API uses the pre-existing SELECT-only local reader; no HTTP write endpoints were added.

Local backend .env now enables geographic reads against localhost5435 with the local reader. Restart the normal backend to pick up those settings; startup still does not automatically run geographic migrations. For the review preview, a separate API process runs on18090 and static web on18091, leaving the existing8000 process intact. Preview export uses EXPO_PUBLIC_API_URL=http://localhost:18090. The same tested export is copied to frontend/dist, so the existing18082 preview also updates when reloaded. Cloud Compose remains opt-out; a later cloud migration/deployment needs its own reviewed plan.

## API contract

- GET /api/geo/buildings/search?q=library&limit=20 → {results:[{id,name,matched_term,match_kind,street,house_number,longitude,latitude}],has_more}. q≤120, limit1–30, no controls; invalid values422.
- GET /api/geo/buildings/{id} → GeoJSON feature, including properties.bounds [west,south,east,north], tags, verified aliases, accessibility_verified and source provenance. Missing building404.
- GET /api/geo/buildings/{id}/entrances → FeatureCollection; each item has association_verified and accessibility_verified. Nearby unverified candidates remain labeled. Maximum500 per page; existing after cursor remains available. UI discloses if capped.

Reads remain public campus metadata, feature-flagged, read-only transactions, bound SQL parameters, small connection pool and3s statement timeout. No account information, GPS coordinates from devices, moderator grants, auth changes or imports are exposed. Search logs contain the requested public building query through the normal server access log; do not treat it as a private messaging input.

## Validation

From active app backend:

```sh
GEO_DATABASE_URL='postgresql+psycopg://spatial:local-spatial-test-only@127.0.0.1:5435/campus_spatial' uv run --locked alembic -c geo-alembic.ini upgrade head
SPATIAL_TEST_URL='postgresql+psycopg://spatial:local-spatial-test-only@127.0.0.1:5435/campus_spatial_test' UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q spatial_tests
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q
UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked ruff check .
```

From frontend:

```sh
npm run typecheck && npm run lint && npm test
EXPO_PUBLIC_API_URL=http://localhost:18090 npx expo export --platform all --output-dir /private/tmp/campus-stage3
```

From app root: python3 -m unittest discover -s scripts/tests -q; git diff --check.

Results:19 real PostGIS tests,51 existing backend tests,41 frontend tests,8 deployment tests passed. Ruff/lint/typecheck/diff check passed. Web/iOS/Android JS exports passed; these are not native binary tests. Existing Starlette testclient deprecation and Stage1 framework dependency advisories remain. No dependencies were added to npm/uv.

New spatial coverage: exact/partial/case-insensitive/literal-wildcard searches, empty/invalid input, reviewed aliases, verified-name cache refresh, duplicate names, exact ranking,40-result fixture/limits, missing metadata, independent association/accessibility, invalid entity references, geo002 rollback protection. Frontend coverage: debounce, URL encoding, request races/cancellation/deadline, error and empty states, keyboard wrapping/selection/Escape, cleanup, geometry/verification labels, loaded-map overlay refresh and style reload.

Live reader-backed HTTP measurements are ../testing/stage-3-http.json: library search13ms/208B;20 results6ms/3.6KB; building details8ms/1.3KB; two entrances11ms/1.4KB. Local single-request timings only. EXPLAIN ANALYZE chooses a sequential scan for157 search terms (0.023ms); indexes exist for larger datasets, but no regional-scale load claim is made.

An exploratory mobile pass exposed a cropped footprint after resize. Camera refit was corrected; lint/typecheck/tests and all-platform exports reran. Final browser evidence is ../testing/stage-3-devices.json. Final screenshots are written alongside the user's review artifacts. Current native checks: simctl connection refused; devicectl timed out after8s; adb unavailable. Native runtime, on-device keyboard, VoiceOver/TalkBack and dark-mode checks are unverified.

## Operator metadata and recovery

Only insert reviewed aliases/entrance associations using the operator database credential. Resolve feature IDs against OSM provenance, inspect geometry, and record the actual source/reviewer/reason. Example parameterized SQL shapes (do not invent real campus values):

```sql
INSERT INTO geo.building_aliases(building_id,label,kind,reviewer,note)
VALUES (:building_id,:verified_label,'abbreviation',:reviewer,:source_and_reason);
INSERT INTO geo.building_entrances(building_id,entrance_id,reviewer,note)
VALUES (:building_id,:entrance_id,:reviewer,:survey_or_source);
```

Accessibility verification should record evidence and the verified tags, preserving any current name/geometry overrides in the new full verification snapshot. The existing latest-record override semantics are unchanged; a new verification record replaces the earlier override snapshot. Never bulk-mark OSM access tags verified merely because an entrance exists.

Back up before metadata/migration changes. See Stage2 recovery procedures: restore a backup into a new database and validate before switching URL; never delete reviewed records to force a downgrade. pg_trgm is retained on downgrade because extensions may be shared. Keep ODbL attribution for campus data; basemap attribution remains separately visible.

## Files and references

Backend: geo_migrations/versions/geo002_search.py; app/geospatial/search.py; queries.py; routers/geographic.py; spatial_tests/test_spatial.py. Frontend maps: destinations.ts, useDestinations.ts, DestinationPanel.tsx, SearchInput(.web).tsx, SuggestionList(.web).tsx, layers.ts, CampusMap(.web).tsx, MapFrame.tsx, controller.ts; tests/destinations.test.mjs and maps.test.mjs. Documentation/status/HTTP/device reports updated.

Official references checked: [Expo57](https://docs.expo.dev/versions/v57.0.0/), [RN0.86 TextInput](https://reactnative.dev/docs/0.86/textinput), [KeyboardAvoidingView](https://reactnative.dev/docs/0.86/keyboardavoidingview), [MapLibre GL Map](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/), [PostgreSQL trigram indexes](https://www.postgresql.org/docs/current/pgtrgm.html). Native documentation endpoint was unavailable; installed11.5.0 public type declarations/source guided GeoJSONSource, Layer and Camera.fitBounds usage, then native exports/typecheck verified compatibility at the JS level.

Next stage: verified pedestrian graph and campus-controlled routing. Entrance/connectivity/accessibility data gaps must remain visible before any accessible-route claim.
