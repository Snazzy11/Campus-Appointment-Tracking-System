# Stage 7 — usability and device-local places (first increment)

Implemented locally in applicaton buildout. This starts Stage 7; it does not claim the entire mobile/location/performance stage is finished.

## Saved and recent destinations

Successful building selections populate up to five recent destinations. A selected building can be saved/removed; up to five saved places are retained. Both lists appear when the destination input is empty. The clear control removes both lists. Reopening always requests current building details and entrances; stored names are labels, not an offline campus dataset.

Only building IDs and names (40-character labels) are stored. Browser storage is origin-local localStorage; native uses the existing Expo SecureStore dependency. Lists are device-local and shared across accounts on that device, explicitly disclosed in the UI. Precise location, route geometry, reports and credentials are not added to this store. Corrupt records are discarded. Storage failures leave the map usable and show an explanation. Writes are serialized to prevent an older write overwriting a newer one.

No tiles are prefetched or bulk-downloaded. Routing still requires connectivity. Opening maps still never requests location. Follow-location, accuracy circles, progress, nearby lists, sharing, offline routing, battery/memory profiling and real iPhone/Android verification remain follow-ups; this increment adds no location tracking.

## High-risk closure review

Moderators approve a report, open Review paths, then optionally choose **Block nearby paths (within 10 m)** for high severity. The API supplies exact geography distance to each graph segment, sorted nearest first, within 50 m (maximum 100). The shortcut selects only segments at most 10 m away. More than 30 requires manual selection; invalid or missing distances are excluded.

Selected segments appear red on the map as a preview. Changing selection resets verification. Publishing selected paths requires explicit moderator verification and a reason. Server authorization, distance checks, lifecycle checks and the 30-edge cap remain authoritative. Whole graph segments are excluded, not just the portion within 10 m. Close parallel paths may be candidates: moderators must inspect the preview and deselect unaffected paths. A high severity report alone never blocks anything. Existing active marker-only reports must be resolved and replaced with a reviewed closure; this change does not retroactively close them.

All route profiles exclude active, verified, unexpired associated segments. Resolution/expiration restores them. SSE invalidates displayed directions when routing conditions change so users calculate against the new conditions. Closure association survives graph rebuilding through stable source segment identifiers.

## Shared sign-in header

Every main tab shows Sign in when signed out and the profile avatar when signed in. The Messaging inbox no longer contains a duplicate login button. Header configuration loading is bounded to ten seconds, with retry and an accessible error dialog. Existing Cognito/PKCE behavior is reused. Direct profile navigation also provides a sign-in action.

## Validation

110 backend/spatial tests and 64 frontend tests pass, plus lint, typecheck and web/iOS/Android exports. Added real PostGIS coverage for measured high-risk candidates, verified activation, route exclusion and restoration. Added frontend distance boundary/preview and corrupt/bounded place storage tests.

Browser checks: actual local map saved/recent data survives reload; compact header sign-in is present. Isolated moderator UI fixture confirms 10 m selection excludes a 22 m-away path, blocks unverified publication, then activates on confirmation. The fixture makes no real report changes; routing assertions use the separate test database. Native bundles exporting does not establish real-device correctness.

## Foreground location follow-up — October 13, 2026

The next increment adds Follow my location / Stop following location, a blue position marker and geographic accuracy shading shared by web/native MapLibre layers. Opening Maps does not start or request location. Following starts only from the explicit button and keeps a single current fix in memory. No history or continuous route-service upload is added. Map-provider tile requests still reveal the viewed area; the UI discloses that distinction. Directions continue to request a starting location separately when the user invokes them.

Navigation away from Maps, browser hiding/pagehide, native backgrounding, stopping and component disposal cancel tracking and clear the marker. Return to Maps requires another explicit start. Changing the destination, selecting a report/entrance or requesting directions stops following so camera actions do not compete. Starting following clears the draft report pin. Native permission dialogs can make iOS temporarily inactive, so only background (not inactive) triggers the native lifecycle stop.

The controller bounds acquisition to 25 seconds and stops after 60 seconds without a usable update. Fixes older than 30 seconds, over 10 seconds in the future, nonfinite coordinates, missing/negative accuracy, accuracy over 1000 metres and coordinates outside the campus bounds are rejected with actionable messages. Accuracy over 50 metres is labeled approximate and unsuitable as a route origin. The ring is an approximate geographic visualization of device-reported accuracy, not a surveyed safety boundary. Camera changes use zero-duration existing map focus behavior.

Browser watches request high accuracy with a 20-second timeout and at most 10-second cached fixes. Native watches use foreground permission, high accuracy and a 5-second Android minimum interval; iOS delivery is controlled by the OS. No background permission or service is introduced. Tracking can consume battery, which must be measured on devices before enabling longer navigation sessions. These changes do not add turn-by-turn navigation or route progress.

### Validation and measurements

74 frontend tests pass, including no automatic acquisition, late-result suppression, restart/stop/disposal, invalid/off-campus/stale fixes, acquisition/stream timeouts, denied permissions, both web/native cancellation races, lifecycle listener cleanup, accuracy geometry and adapter cleanup. Lint/typecheck and web/iOS/Android exports pass. Backend is unchanged in this increment; its prior 110-test pass remains the last backend run.

Actual local preview opens with the new control without requesting permission. An isolated browser fixture of the real controller and panel verifies a synthetic campus fix, 15m accuracy display, 150m warning, stop and late-fix rejection, and denied-permission recovery. This does not verify actual GPS or native sensors. Desktop preview remains 905×724; prior viewport override limitation and native-device gate remain open.

Ten sequential loopback samples per operation on the local Mac/PostGIS setup: building search median 3.52ms (max 5.20ms), Robinson Hall→Pearce Hall walking route median 110.05ms (max 141.27ms), active-report read median 3.52ms (max 9.83ms). Raw samples: ../testing/stage-7-performance.json. Initial local API regression budgets: search/report reads under 100ms and routing under 500ms for this fixture, excluding user-input debounce. These are diagnostic local budgets, not production SLAs. Map render/interactive time, tile volume, GPU/memory and battery still need measured browser/device runs. Existing network deadlines and stale-route invalidation remain in effect.

Nearby discovery, share links, progress and additional offline caching remain optional follow-ups. Stage 8 can proceed independently with sourced heights; native Stage 7 verification is still pending.
