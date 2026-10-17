# Campus navigation implementation status

## Stage 0 — Audit and baseline

Audit and automated baseline implemented/tested. Final responsive pass results: ../testing/stage-0-devices.json. Native baseline unverified due unavailable CoreSimulator service, absent Android tooling and no rebuilt active-folder native binary. No database changes.

Files: architecture/current-system.md, architecture/geospatial-design.md, testing/baseline.md, decisions/0001-geospatial-integration.md, geospatial/STATUS.md, geospatial/requirements.md. Exact commands/results and regression limitations are in baseline.md. Final device verification is the last Stage 0 activity; its artifact is appended by that pass.

## Remaining stages

| Stage | Status | Required gate/dependency |
| --- | --- | --- |
| 1 Map foundation | Implemented, not fully verified | Licensed provider configuration; native MapLibre binary; renderer tests and final devices |
| 2 Spatial data | Implemented locally | Real ARM PostGIS tests pass; core coverage/verification limitations documented |
| 3 Building search | Implemented locally; native unverified | Search/details/map selection and automated tests; final browser report; native device gate pending |
| 4 Pedestrian routing | Implemented locally; native unverified | Real graph/profile tests and browser routing; source connectivity/accessibility still unverified |
| 5 Blips | Implemented locally; native unverified | Moderated reports, bounded submissions, explicit verified path impact; real-account browser moderation still to verify |
| 6 Real-time maps | Implemented locally; native unverified | Durable PostgreSQL snapshot SSE; public cross-worker/restart tested; existing authenticated sessions remain single-worker |
| 7 Advanced features | Local saved/recent places and foreground location following implemented; native unverified | Device GPS/battery verification and remaining performance measurements |
| 8 3D | Planned | Height/terrain provenance, capability and GPU fallback tests |
| 9 Gaussian splats | Blocked on assets | No licensed georeferenced campus scene provided; foundation can be prepared later |
| 10 Hardening | Planned | Complete prior-stage operational and test evidence |

A status of planned does not mean code exists. Keep account, provider, asset and device dependencies explicit. No mapping rollout to messaging.tufts.pro is authorized by this document.


Stage 1 report: [stage-1.md](stage-1.md). Provider setup: [PROVIDER-SETUP.md](PROVIDER-SETUP.md). Maps now has platform-specific foundation components and defaults disabled pending configured licensed styles. Later stages remain planned until Stage 1 acceptance is satisfied or an explicit external dependency permits independent work.


OpenFreeMap follow-up: user selected free hosted street tiles; satellite/hybrid and offline mapping are deferred. Local web/native style URLs are configured without keys. See [follow-up report](stage-1-openfreemap.md) and [provider setup](PROVIDER-SETUP.md). Native device verification remains required before claiming full Stage 1 completion.

Stage 2 implemented locally with real ARM PostGIS/pgRouting integration, core OSM extract, geographic read endpoints and quality reports. See [stage-2.md](stage-2.md). Explicit independent spatial migration chain protects existing startup; read API opt-in. Core coverage/relations/verification gaps are documented; no production rollout. Stage 3 can begin with this data. Native verification remains blocked externally.

Stage3 report: [stage-3.md](stage-3.md). Building suggestions, details and destination highlighting now use the local geographic API. Directions remain Stage4; reviewed abbreviations can be added with source evidence.

Stage4: [pedestrian routing report](stage-4.md). Local opt-in graph, public read-only route API and shared web/native route planner. No cloud rollout; full native and surveyed accessibility verification remain pending.

2026-10-13 routing follow-up: unverified boundary approaches unblock missing-entrance buildings; 72/72 campus route checks passed. Generated 59 GIS entrance candidates for review. Destination-first directions reveal editable From and try location on request. Backend/spatial 88, frontend 51 tests passed; lint/typecheck and web export passed. Final browser verification: Robinson → Pearce 669m, From hidden before directions, manual origin cancels location; nine viewport sizes 320–2560px have no horizontal overflow. See stage-4.md and docs/testing/approach-devices.json. Door confirmation still requires authoritative GIS/on-site evidence; native and actual GPS remain unverified. Local preview only.

Stage5: [Campus reports](stage-5.md). geo004 applied to backed-up local spatial DB, dedicated report writer configured. carter@tufts.pro explicitly granted local admin at user request. Backend/spatial104, frontend55, deployment8 tests passed; lint/typecheck and web/iOS/Android exports passed. Final responsive browser report: ../testing/stage-5-devices.json. No cloud rollout. Native runtime still blocked by unavailable CoreSimulator/CoreDevice and absent adb.

Stage6: [Live reports and routing availability](stage-6.md). Moderator reason errors now appear inline on each report. Browser fixture passed approve/reject/publish/resolve; 109 backend/spatial, 61 frontend and 8 deployment tests passed, plus lint/typecheck/Ruff and all-platform exports. Local preview updated; no cloud rollout. Final responsive verification: ../testing/stage-6-devices.json.

Stage 7 started locally: device-local saved/recent buildings, high-risk nearby closure selection with a red preview, and shared header sign-in. See [stage-7.md](stage-7.md) for implemented scope and remaining location/performance/device work. No EC2 deployment in this increment.

Stage 7 location follow-up: explicit foreground following, accuracy overlay, cancellation and lifecycle privacy tests; 74 frontend tests, lint/typecheck and all exports pass. Local API latency baseline recorded in testing/stage-7-performance.json. Optional discovery/sharing/progress remain deferred; native and actual GPS verification still pending.
