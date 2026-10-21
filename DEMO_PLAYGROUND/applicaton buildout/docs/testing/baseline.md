# Stage 0 baseline — 2026-10-13

## Plan and acceptance

Inventory active code, read configuration/models/migrations, run unchanged tests and exports, inspect local extension availability, document risks, then perform final web/native verification. Acceptance: architecture/entry points identified, baseline recorded, integration points and native availability established, major dependencies explicit. No implementation or migration in this stage.

## Commands and observed results

| Command (working directory) | Result |
| --- | --- |
| npm run lint (frontend) | Pass |
| npm run typecheck (frontend) | Pass |
| npm test (frontend) | 25 pass |
| npx expo export --platform all --output-dir /private/tmp/campus-geospatial-baseline (frontend) | Web, iOS and Android exports pass; exports are not native compilation/device testing |
| UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked pytest -q (backend) | 51 pass; existing Starlette/httpx deprecation warning |
| UV_CACHE_DIR=/private/tmp/campus-buildout-uv uv run --locked ruff check . (backend) | Pass |
| python3 -m unittest discover -s scripts/tests -q (app root) | 8 pass |
| Read-only SQL SELECT current_database(),version(); SELECT name,default_version,installed_version FROM pg_available_extensions WHERE name IN ('postgis','pgrouting'); SELECT version_num FROM alembic_version | campus_buildout; PostgreSQL 17.11 ARM64; no spatial packages; head d8b4a21e653c |

No functional failures found in automated baseline. Auth/messaging coverage uses SQLite/mocked Cognito, not real spatial data, physical devices or complete authenticated browser workflows. No CI or browser E2E runner found. Dark mode is not supported (app config light); native orientation currently portrait.

## Final verification pass

See stage-0-devices.json for the executed web matrix. Map interactions are not applicable: Maps is a placeholder. Browser output tests safe layout/tab navigation, not native touch behavior or actual authenticated messaging. Chromium/Firefox independent engines are not available through the current browser automation surface.

Native availability inventory: Xcode command-line tooling exists. No generated ios/android project in this active folder. `xcrun simctl list devices booted` cannot connect to CoreSimulatorService in the restricted session and reports EPERM opening its log; `adb devices` fails because adb is not installed. Physical-device testing is unverified. Do not claim browser emulation, native JS export or an older sibling's binary as native verification of this baseline.

Stage 0 outcome: audit and automated baseline complete; final web results recorded separately; native verification has documented environmental limitations. Stage 1 requires configured licensed tile styles and a rebuilt native development client. No database or production changes made.
