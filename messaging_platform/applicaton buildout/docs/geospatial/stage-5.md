# Stage 5 — Campus reports (blips)

## Scope and design
Local implementation in applicaton buildout, with an additive geo004 migration and separate least-privilege writer connection. Production remains unchanged. Reports are points in WGS84 within the campus study extent; the database geometry column permits future lines and polygons but the current submission API only accepts a point. No polygon drawing or photo uploads are claimed.

Categories live in geo.blip_categories: construction, closed sidewalk, road closure, icy walkway, flooding, accessibility obstruction, campus event, general hazard and other. Operator-added categories appear in the UI without a frontend release. Reports store author ID, category, plain-text description, geometry, low/medium/high severity, creation/update/expiry timestamps, moderation status and verification. Public payloads omit author identity. Author IDs refer to the existing messaging account database; there is deliberately no cross-database foreign key.

Select a building and open Report an issue to start a draggable orange pin near its center, or use Place report pin to start at campus center. Drag the pin or tap the main map to choose the actual issue location; no coordinate typing is required. Web users can focus the pin and use arrow keys. Cancel/close/submit clears the draft pin. Pin placement alone does not submit a report and is available before sign-in. The form supports description, severity and expiration hours. Public report cards can focus the map on a marker. This is not an emergency dispatch service.

## Lifecycle and permissions
Authenticated bearer sessions may submit and read their own reports. Five submissions per rolling hour per account, enforced using a PostgreSQL transaction advisory lock shared across workers. Open same-author/category reports within 10 m are rejected as duplicates; multiple independent witnesses are allowed. Expiration must be 1 minute–30 days away. Request fields are strict; users cannot supply author, moderation or verification fields.

Moderator: pending → approved or rejected; approved → active; pending/approved/active → resolved. Expired reports cannot activate. Status on reads is effectively expired when the deadline passes; they disappear from the public map/queue and stop affecting routes without a scheduled worker. Terminal states cannot reopen. A row lock prevents simultaneous state transitions from both succeeding. Every submission, moderation action and role change is audited. Notes are required for moderator actions.

Admins can grant/revoke moderator permissions through POST /api/geo/reports/roles. Admin bootstrap/change remains an explicit operator task; ordinary users and moderators cannot grant roles. The user explicitly selected carter@tufts.pro; its unique verified local account was granted admin, with an audit record. No other account received a grant. Example bootstrap, after looking up and confirming the intended account ID in the messaging database:
```sql
INSERT INTO geo.blip_roles(user_id,role) VALUES (<confirmed-account-id>, 'admin');
```
This is an operator-only SQL template, not an HTTP endpoint. Do not expose migration/admin database credentials to the application.

## Route impact
A marker alone never closes anything. During activation a moderator may choose up to 30 existing graph segments within 50 m of the report, explicitly confirm verification, and provide evidence in the moderation note. The UI lists nearby segments, their lengths and endpoint coordinates. The API independently checks authorization, freshness, proximity and segment existence. The moderator must confirm the real extent of the closure; proximity is only a candidate filter.

Associations store source feature ID and endpoint OSM node IDs, not rebuildable edge IDs. Only active, verified, unexpired associations exclude matching segments for all route profiles. Resolution/expiration restores eligibility. Source graph rebuilds preserve matching associations; topology changes that remove an endpoint pair require re-review. Do not assume a closure is re-associated to new geometry automatically. Existing independent operator path_closures remain honored.

## API and storage
Public GET /api/geo/reports and /categories. Private bearer GET /account, /private?scope=mine|queue, /{id}/paths. POST /api/geo/reports submits; POST /{id}/moderate transitions; POST /roles grants moderator roles. Lists use an after-ID cursor with max100 results, and return next_after. UI currently shows the first100 with an explicit limit notice. Stage6 now synchronizes reports through SSE; see stage-6.md. Local expiry cleanup now removes markers within about one second of their deadline.

No report attachments are accepted yet. Existing avatar storage validates/resizes profile photos and is not an attachment authorization/storage lifecycle; reusing its URL fields would be unsafe. No new upload surface was introduced.

Retention: expired/rejected/resolved reports and audit entries are retained for review; no automatic destructive cleanup. Before production, decide the institution's retention period, account-deletion/anonymization policy and backup retention. Do not collect personal details in report descriptions. There is no claim of a production retention policy.

## Setup and rollback
Back up the spatial DB before:
```sh
GEO_DATABASE_URL=<operator-spatial-url> uv run --locked alembic -c geo-alembic.ini upgrade head
```
The existing route query now requires geo004. Upgrade the spatial schema before updating an enabled routing server. geo004 refuses downgrade when reports, roles or audits exist; restore the backup into a separate DB and validate before switching connections.

Set GEO_REPORTS_ENABLED=true and GEO_REPORT_DATABASE_URL to a dedicated role. Default example configuration is disabled. Grant USAGE on geo, SELECT on its tables, INSERT/UPDATE on blips, INSERT on blip_edges/blip_audit, INSERT/UPDATE/DELETE on blip_roles, and USAGE/SELECT on geo sequences. The role cannot modify source features, graph edges or messaging tables. Also grant the existing geographic reader SELECT on the new tables for routing. Keep all credentials server-side.

Local pre-migration backup: .data/backups/pre-blips.dump (ignored). Local writer configured privately in backend/.env. No cloud migration/deployment. The user-authorized local admin grant is recorded above.

## Validation
Commands:
- backend: SPATIAL_TEST_URL=<isolated campus_spatial_test URL> uv run --locked pytest -q tests spatial_tests
- backend: uv run --locked ruff check app/geospatial/blips.py app/routers/blips.py geo_migrations/versions/geo004_blips.py spatial_tests/test_blips.py
- frontend: npm run lint; npm run typecheck; npm test
- frontend: EXPO_PUBLIC_API_URL=http://127.0.0.1:18090 npx expo export --platform all --output-dir /private/tmp/campus-stage5 --clear

104 backend/spatial tests passed, including16 report tests covering validation, auth, roles, duplicate/rate limits, lifecycle, expiry, XSS text, edge proximity, graph rebuild and route restoration. 56 frontend tests and 8 deployment tests passed. Frontend loader tests cover expiry, stale results, disposal, failures and request deadline. Test fixtures use synthetic actors only in the isolated rollback-only spatial test DB. Native binary/GPS and real-account moderator browser flows are not covered by these automated tests.

Final device/browser results are recorded in ../testing/stage-5-devices.json. Native runtime validation remains externally blocked; platform exports are bundle checks, not device execution. Stage6 is the next independent implementation stage; full native acceptance is still pending.

### Draggable pin follow-up
Implemented web MapLibre draggable Marker and native ViewAnnotation, with tap-to-place, keyboard movement on web, campus bounds checks, reset and cancel controls. Native invalid drops remount at the last valid position. Browser verified pointer drag, tap and arrow-key movement. Lint/typecheck, 56 frontend tests and all-platform export passed. Native runtime remains unverified. Final responsive check: ../testing/report-pin-devices.json.
