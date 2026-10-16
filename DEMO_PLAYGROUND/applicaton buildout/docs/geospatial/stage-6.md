# Stage 6 — Live map reports and route availability

Implemented locally in applicaton buildout. No EC2 changes or new database migration.

## Transport and recovery
GET /api/geo/reports/stream is public and includes only currently active public reports. GET /api/geo/reports/private/stream?scope=mine|queue requires a bearer session; queue additionally requires a current moderator/admin grant. Pending submissions, approvals, rejections, activation, resolution and expiration propagate through authoritative replacement snapshots. This is current-state synchronization, not an audit-history feed.

Each connection starts with a complete snapshot from a short read-only REPEATABLE READ transaction. Every two seconds the server checks PostgreSQL again; changed state emits:
- event: map_snapshot
- id: SHA256 of the serialized snapshot
- data: reports (GeoJSON collection with next_after) and routing_version (opaque fingerprint)
Unchanged state emits a keepalive approximately every10 seconds. Errors emit map_unavailable; revoked authorization emits access_revoked and closes the stream. Error frames never contain SQL or credentials.

Reconnect always sends current authoritative state, regardless of Last-Event-ID. Intermediate transitions missed during disconnection are not replayed, but the current published markers/queue and routing availability are recovered. Identical client snapshots are ignored. Lists retain the Stage5 100-item bound and explicit next_after; UI still displays the first100. Expired markers are also removed locally.

The client reuses the existing SSE fetch/parser transport, with an opt-in30-second connection/read deadline for map streams. Retry delay is2 seconds; stop/unmount aborts the request, cancels reader/timers and prevents retries. 401/403 are terminal. The moderation queue subscribes only while open, and old subscriptions are disposed when switching scope or accounts. Approval/publishing updates therefore need no manual refresh button.

When the route availability fingerprint changes—or live updates disconnect—the client clears a displayed/in-flight route and explains that directions should be recalculated. It retains the chosen endpoints. Closure fingerprints cover active verified report associations, independent operator closures and graph rebuild/dirty state; expiration changes the fingerprint automatically.

## Durability, workers and limitations
PostgreSQL is the durable source. Two independent API processes observe the same committed snapshots, including after restart. There is no process-local broadcast queue and no assumption that an in-memory bus crosses worker boundaries. LISTEN/NOTIFY was considered: it would reduce polling, but notifications alone have no durable replay and still require snapshot recovery. For this small local prototype, bounded database polling is simpler; measure database load before production scale (roughly two short queries per client every2 seconds). A shared changefeed/broker plus versioned snapshots is the next scaling option.

Existing authentication is still a development-only in-memory session store. Consequently public map streams work across workers, but authenticated subscriptions and moderation deployment remain single-worker until shared session storage is implemented. API restarts require users to sign in again. This stage does not claim to have made existing messaging/auth infrastructure multiworker-safe. Private streams recheck sessions each polling cycle and current queue roles on each read; no database connection is held for the lifetime of a stream.

Nginx/proxies must permit long responses and disable buffering/cache for these routes; responses set X-Accel-Buffering:no and Cache-Control:no-cache,no-transform. Set proxy_read_timeout above the heartbeat interval (60s or more). No production proxy configuration was changed.

## Moderation usability correction
The10-character requirement applies to the moderator's reason, not the student's report description. Each report now has its own labeled reason box, live count and inline validation. Action labels explain Approve report → Publish on map, Reject report, and Mark resolved. Backend validation also names the moderation reason instead of a generic string-length error. Draft notes remain tied to the report ID.

An isolated browser harness rendered the actual BlipPanel with synthetic reports and a fixture API: missing reason showed an inline explanation; approve, reject, publish and resolve each succeeded. Real PostgreSQL/API tests independently exercise the lifecycle, permissions and route effects. No real user's report was accepted/rejected merely for testing.

## Validation and limits
- Backend/spatial pytest suite, including two independent HTTP servers receiving one committed activation and a restarted server recovering the same snapshot.
- Isolated-process snapshot comparison, multi-client generators, duplicate suppression, permission revocation, sanitized DB errors, expiry/public privacy.
- Frontend tests include moderation reason validation, duplicate snapshot handling, route invalidation, network interruption/reconnect, connection deadline and cleanup/403 behavior, plus existing messaging SSE/parser regressions.
- Lint/typecheck, Ruff and all-platform Expo exports.
- Browser admin fixture actions plus final responsive map pass: ../testing/stage-6-devices.json.
Native runtime remains unverified because CoreSimulator/CoreDevice were unavailable and adb absent. Bundle export is not an on-device test. Signed-in live queue delivery through a real Cognito session still needs hands-on validation; server/session permission checks and UI transitions are tested separately.

Final results: 109 backend/spatial tests, 61 frontend tests and 8 deployment tests passed. Ruff/lint/typecheck and web/iOS/Android exports passed. All nine final viewports show live reports and per-report inline validation with no horizontal overflow. A reconnect-display issue discovered in the first device pass was corrected: an identical recovery snapshot now clears connection warnings without redundantly replacing report data. The final pass was repeated after that fix. Direct HTTP verification confirmed initial snapshot delivery, a keepalive at about10 seconds, and anonymous rejection from the private stream.
