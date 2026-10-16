# CODEX MASTER IMPLEMENTATION PROMPT
## CMU Campus Navigation & Geospatial Platform

### Role and mission

You are the lead software architect, full-stack engineer, geospatial systems engineer, accessibility engineer, security engineer, and quality assurance engineer responsible for extending an existing campus application with a production-oriented mapping and navigation platform.

Your task is to **inspect, design, implement, test, document, and integrate** a comprehensive Central Michigan University campus navigation system.

The application already contains substantial functionality. Do not assume the repository matches any earlier description. The repository is the authoritative source of truth.

**Primary objective:** Build a modular geospatial platform supporting interactive street maps, satellite imagery, campus buildings, pedestrian navigation, accessible routes, geospatial reports ("blips"), real-time updates, and an extensible foundation for future 3D terrain, building models, and Gaussian splatting.

Implement the platform incrementally, preserving existing functionality.

Do not replace existing architecture unnecessarily.

---

# GLOBAL ENGINEERING RULES

## Rule 1 — Inspect before modifying

Before writing implementation code:

1. Identify the repository root.
2. Examine the complete relevant project structure.
3. Read existing README files and development documentation.
4. Identify frontend frameworks and routing libraries.
5. Identify backend frameworks and API conventions.
6. Inspect database models and migration history.
7. Identify authentication and authorization mechanisms.
8. Identify existing geolocation, mapping, navigation, or GIS functionality.
9. Identify existing web, PWA, mobile, and native application targets.
10. Inspect existing automated tests, CI configuration, and build scripts.
11. Inspect package managers, dependency versions, and lockfiles.
12. Identify development, staging, and production deployment configurations.
13. Record the repository's baseline test results.

Do not overwrite an existing mapping implementation without evaluating whether it can be extended.

Do not assume React, FastAPI, PostgreSQL, or any particular mobile framework is still in use merely because those technologies were used previously.

Prefer existing project conventions when technically sound.

## Rule 2 — Research current documentation

Before introducing any major dependency, consult current official documentation where network access is available.

Primary technologies to evaluate:

- MapLibre GL JS
- OpenStreetMap and relevant usage policies
- MapTiler or equivalent tile providers
- PostGIS
- pgRouting
- Valhalla
- GeoAlchemy2
- Three.js
- Gaussian-splat rendering libraries
- Existing frontend and native frameworks
- Existing testing frameworks

Verify API compatibility, maintained versions, licensing requirements, security advisories, and platform support.

Do not invent package APIs or configuration options.

If external documentation is unavailable, explicitly record that limitation and use the repository's installed dependency versions and locally available documentation.

## Rule 3 — Preserve existing functionality

The mapping system must coexist with existing application features, including:

- Authentication and user sessions
- Public messaging
- Private messaging
- Real-time messaging
- Existing application navigation
- Database relationships
- Any currently implemented calendar, scheduling, or campus features

Before changing shared infrastructure, identify its consumers and regression risks.

Prefer additive database migrations and backward-compatible API changes.

Never delete existing data to make a migration pass.

## Rule 4 — Implement in stages

Complete stages in the prescribed order.

For every stage:

1. Inspect relevant existing implementation.
2. Write a concise technical implementation plan.
3. Define acceptance criteria.
4. Implement the functionality.
5. Add or update automated tests.
6. Run relevant unit and integration tests.
7. Perform security and performance checks.
8. Update documentation.
9. Run regression tests.
10. **As the final stage activity, perform web responsive and native-device testing.**
11. Record results, limitations, and remaining issues.

Do not begin the next stage until the current stage's acceptance criteria are satisfied, unless blocked by an external dependency.

Do not claim tests passed unless they actually ran.

If a test cannot run, identify the precise reason and classify it as unverified.

## Rule 5 — Native and web testing order

Device and viewport testing must occur **last in every stage**.

This is a strict ordering requirement.

All implementation work, ordinary automated tests, documentation updates, and regression tests must finish before beginning final cross-device verification.

For each stage's final testing pass:

- Test supported desktop web viewport sizes.
- Test tablet portrait and landscape layouts.
- Test mobile portrait and landscape layouts.
- Test the native application on supported platforms.
- Test touch interaction where applicable.
- Test safe areas, navigation controls, keyboard behavior, and scrolling.
- Test orientation changes.
- Test dark and light themes if supported.
- Check for clipping, overflow, unreadable labels, and unusable controls.
- Verify that new features do not interfere with existing navigation.

If no native application currently exists, do not silently create one. Document the missing native target and recommend an integration strategy.

Browser emulation is not equivalent to testing on a real native device. Clearly distinguish emulator, simulator, physical-device, and browser testing.

If defects are found during the final device-testing pass, fix them, rerun affected automated and regression tests, update documentation, and repeat the final device-testing pass. The stage is not complete until its last activity is successful device verification or a clearly documented environmental limitation.

---

# STAGE 0 — REPOSITORY AUDIT AND BASELINE

## Objectives

Understand the current application and establish a reliable baseline.

### Tasks

1. Generate a concise repository architecture inventory.
2. Identify frontend and backend entry points.
3. Identify database configuration and migrations.
4. Identify session authentication and permission models.
5. Identify existing SSE or WebSocket infrastructure.
6. Identify native application projects or wrappers.
7. Identify test coverage and missing test infrastructure.
8. Record existing mapping dependencies, if any.
9. Determine whether the existing PostgreSQL installation supports PostGIS and pgRouting.
10. Identify local development startup commands.

### Deliverables

Create or update:

- `docs/architecture/current-system.md`
- `docs/architecture/geospatial-design.md`
- `docs/testing/baseline.md`
- `docs/decisions/` for architectural decision records

Use equivalent existing documentation locations if the repository already has a documentation structure.

### Testing

Run the existing tests and builds without changing functionality.

Record failures that predate the mapping implementation.

### Acceptance criteria

- Existing architecture is understood.
- Current test baseline is recorded.
- Mapping integration points are identified.
- Native application availability is established.
- Major technical risks are documented.

### Final activity

Perform baseline web and native-device verification using the global device-testing requirements.

---

# STAGE 1 — MAP FOUNDATION

## Objective

Introduce an interactive campus map without disrupting existing application functionality.

### Technology preference

Use MapLibre GL JS for the web frontend unless repository inspection reveals a compelling incompatibility.

For native applications, investigate the existing framework and select a compatible native map implementation. Do not assume a web mapping library can be used directly in every native environment.

### Implementation

1. Create an isolated mapping feature/module.
2. Add a dedicated campus map route or navigation destination.
3. Initialize a MapLibre map centered on Central Michigan University's Mount Pleasant campus.
4. Use verified campus coordinates and an appropriate initial zoom.
5. Implement loading, error, and unavailable-state UI.
6. Add map zoom and navigation controls.
7. Support mouse, keyboard, and touch interactions.
8. Implement map resize handling.
9. Ensure map instances and event listeners are cleaned up correctly.
10. Prevent unnecessary map recreation during React rerenders.
11. Implement provider configuration through environment variables.
12. Ensure provider credentials are not accidentally exposed as unrestricted secrets.

### Map modes

Implement:

- Vector street map
- Satellite imagery
- Hybrid satellite mode with labels
- Extensible future 3D mode

Use properly licensed map tiles.

Do not use public OpenStreetMap tile infrastructure as an unrestricted production tile service.

Preserve application overlays when changing basemap styles.

### Tests

- Map component initialization
- Map cleanup
- Style switching
- Provider configuration
- Missing API key handling
- Tile loading failures
- Component error boundaries
- Keyboard navigation
- Map resize behavior
- Existing application regression tests

### Documentation

Document:

- Mapping architecture
- Required environment variables
- Tile provider setup
- Attribution requirements
- Development configuration
- Production configuration
- Provider switching procedure

### Acceptance criteria

Users can open the campus map and switch between supported basemaps without losing map position or breaking existing application features.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 2 — POSTGIS AND CAMPUS GEOGRAPHIC DATA

## Objective

Establish a reliable geographic database for campus features.

### Database requirements

Use PostgreSQL with PostGIS where compatible with the existing infrastructure.

Create a dedicated geographic schema or equivalent namespace.

Implement entities for:

- Buildings
- Building entrances
- Pedestrian paths
- Path intersections
- Campus landmarks
- Map data sources
- Geographic data verification records

### Geometry requirements

Use a consistent spatial reference strategy.

Use WGS84 (`EPSG:4326`) for geographic interoperability.

Use geography calculations or appropriate projected coordinates for meter-based distance operations.

Implement spatial indexes.

### Data ingestion

Build a repeatable OpenStreetMap import pipeline.

The pipeline must:

1. Download or consume appropriately licensed OSM data.
2. Import relevant campus features.
3. Preserve original OSM identifiers where useful.
4. Track import timestamps.
5. Preserve data provenance.
6. Validate geometry types.
7. Detect invalid geometries.
8. Detect duplicate features.
9. Detect missing building entrances.
10. Support incremental updates.
11. Preserve verified campus-specific overrides.
12. Avoid silently overwriting manually verified geographic information.

Do not treat all OSM data as authoritative or complete.

### Campus data quality

Develop validation reports for:

- Missing building names
- Missing entrances
- Unconnected sidewalk segments
- Duplicate path segments
- Unexpected path intersections
- Invalid building footprints
- Missing accessibility attributes

### APIs

Implement appropriately authenticated or public read endpoints for:

- Campus buildings
- Building details
- Building entrances
- Campus landmarks
- Geographic feature queries within a bounding box

### Tests

Include:

- Migration tests
- Migration rollback tests where feasible
- Spatial query tests
- Geometry validation tests
- Duplicate handling tests
- Import idempotency tests
- Geographic boundary tests
- Data provenance tests
- Authorization tests
- Existing database regression tests

Use a real PostGIS-enabled test database for spatial integration tests.

### Documentation

Document schema, migrations, imports, data licensing, validation, and operational recovery procedures.

### Acceptance criteria

Campus buildings and geographic features can be imported, validated, queried, and displayed without damaging existing application data.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 3 — BUILDING SEARCH AND DESTINATION SELECTION

## Objective

Allow students to find and select campus destinations.

### Features

Implement:

- Building name search
- Building abbreviation search
- Partial-name matching
- Search result ranking
- Building details
- Building map highlighting
- Entrance selection
- Search suggestions
- Empty-state handling
- Search result keyboard navigation

Use database-backed search rather than hardcoding a list of campus buildings.

Support alternate names and abbreviations where verified data exists.

### User experience

Selecting a building should:

1. Focus the map on the destination.
2. Highlight the building.
3. Display available information.
4. Show verified entrances.
5. Offer directions.
6. Indicate whether accessibility information has been verified.

### Tests

Test:

- Exact matches
- Partial matches
- Case-insensitive search
- Abbreviations
- Duplicate names
- Missing building metadata
- Empty queries
- Invalid input
- Keyboard navigation
- Large result sets
- API failures

### Documentation

Document search behavior, indexing, API contracts, and data quality limitations.

### Acceptance criteria

Users can reliably locate campus buildings and select navigation destinations.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 4 — CAMPUS PEDESTRIAN ROUTING

## Objective

Implement campus-specific walking navigation.

### Routing architecture

Use PostGIS and pgRouting for a campus-controlled pedestrian graph, unless the repository audit demonstrates a better justified architecture.

Valhalla may be used as an initial comparison or fallback, but do not introduce multiple routing engines without a clear operational reason.

### Graph construction

Represent sidewalks as connected graph edges and nodes.

Support:

- Pedestrian sidewalks
- Shared-use paths
- Crosswalks
- Building approaches
- Entrances
- Stairs
- Ramps
- Restricted paths
- Temporary closures

Ensure graph intersections represent actual pedestrian connectivity.

Do not connect paths simply because their geometries cross.

### Routing profiles

Implement at least:

- Standard walking
- Step-free / accessibility-oriented walking
- Shortest distance

Design the system so additional profiles can be added later.

### Cost model

Use configurable edge costs based on:

- Distance
- Estimated walking duration
- Stairs
- Surface condition
- Slope where verified
- Access restrictions
- Temporary closures

Use explicit restrictions for inaccessible segments rather than arbitrary penalties where appropriate.

### Routing endpoints

Provide APIs for:

- Coordinate-to-coordinate routes
- Current location to building
- Building-to-building routes
- Entrance-specific routes
- Route recalculation

Return:

- GeoJSON geometry
- Distance
- Estimated duration
- Traversed path identifiers
- Selected routing profile
- Accessibility warnings
- Data confidence or verification status

### Map UI

Implement:

- Origin selection
- Destination selection
- Route display
- Route clearing
- Alternative routes where supported
- Estimated travel time
- Distance display
- Recalculate route
- Navigation loading and error states

### Critical accessibility requirement

Do not describe an unverified route as guaranteed wheelchair-accessible.

Distinguish verified step-free paths from routes inferred from incomplete geographic data.

### Tests

Include:

- Graph connectivity
- Shortest path correctness
- Closed edge avoidance
- Stair exclusion
- Disconnected components
- Unreachable destinations
- Invalid coordinates
- Same origin and destination
- Routing near graph boundaries
- Entrance snapping
- Route geometry validity
- Distance calculations
- Performance with representative campus graph sizes

Create deterministic routing fixtures with known expected outcomes.

### Documentation

Document routing graph construction, algorithms, cost functions, accessibility assumptions, API contracts, and limitations.

### Acceptance criteria

Users can navigate between campus buildings using valid pedestrian routes, with clear handling of incomplete accessibility data.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 5 — BLIPS AND GEOSPATIAL REPORTING

## Objective

Introduce interactive geographic reports that can optionally affect navigation.

### Blip categories

Support an extensible category system, initially including:

- Construction
- Closed sidewalk
- Road closure
- Icy walkway
- Flooding
- Accessibility obstruction
- Campus event
- General hazard
- Other

### Geometry

Support point reports initially.

Design the database and APIs to accommodate line and polygon reports.

### Blip fields

Include:

- Unique identifier
- Author
- Category
- Description
- Geographic geometry
- Severity
- Creation timestamp
- Update timestamp
- Expiration timestamp
- Moderation status
- Verification status
- Associated routing edges
- Optional attachments, subject to existing storage infrastructure

### Permissions

Implement separate permissions for:

- Ordinary users
- Moderators
- Administrators

Ordinary users may submit reports but must not directly mark routing edges as officially closed.

### Moderation workflow

Implement:

1. Report submission.
2. Validation.
3. Moderation queue.
4. Approval or rejection.
5. Optional association with routing edges.
6. Activation.
7. Expiration or resolution.

### Routing integration

Only sufficiently verified and authorized reports may change routing behavior.

Do not automatically close a sidewalk merely because a user placed a marker near it.

### Tests

Include:

- Input validation
- Permission boundaries
- Geometry validation
- Report expiration
- Moderation transitions
- Edge association
- Route impact
- Malicious input
- Rate limiting
- Duplicate reports
- Invalid status transitions

### Documentation

Document blip categories, lifecycle, permissions, moderation, retention, and route-impact policies.

### Acceptance criteria

Users can submit and view reports while moderators control which reports affect official navigation.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 6 — REAL-TIME GEOSPATIAL UPDATES

## Objective

Display new and updated blips without refreshing the application.

### Architecture

Reuse existing application event infrastructure where practical.

Use SSE for server-to-client updates unless repository inspection identifies a better existing mechanism.

### Requirements

- Authenticated subscriptions where appropriate
- Blip creation events
- Blip update events
- Blip resolution events
- Route closure updates
- Automatic reconnection
- Initial state synchronization
- Recovery after missed events
- Correct event cleanup
- No duplicate event listeners
- Multiple connected clients
- Multiple application workers where supported

Do not assume an in-memory event manager works across multiple processes.

Evaluate PostgreSQL LISTEN/NOTIFY or a shared event broker if required.

### Tests

Include:

- Event delivery
- Multi-client updates
- Reconnection
- Missed event recovery
- Duplicate event handling
- Authorization
- Cross-worker delivery
- Backend restart
- Network interruption
- Existing messaging SSE regression tests

### Documentation

Document event schemas, delivery guarantees, reconnect behavior, deployment requirements, and failure recovery.

### Acceptance criteria

Map updates propagate reliably to connected clients, and reconnecting clients recover the current authoritative state.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 7 — ADVANCED MAP FEATURES

## Objective

Improve usability, performance, and reliability.

### Features

Implement as appropriate:

- User location with explicit permission
- Follow-my-location mode
- Location accuracy visualization
- Route progress display
- Nearby building discovery
- Nearby active blips
- Saved destinations
- Recent destinations
- Shareable building links
- Shareable route links
- Improved map labels
- High-density display support
- Dark mode map styling
- Low-bandwidth behavior

### Location privacy

Never request location permission merely because the map page opens.

Request it when a location-dependent feature is invoked.

Do not continuously upload or retain precise user locations without a defined need and appropriate user controls.

### Offline behavior

Investigate practical offline support for:

- Previously viewed map areas
- Cached building metadata
- Previously calculated routes
- Basic navigation during temporary connectivity loss

Do not cache third-party map tiles contrary to their licenses.

Do not promise offline routing unless the necessary graph and algorithm are actually available locally.

### Performance

Measure:

- Initial map render time
- Time to interactive
- Tile request volume
- Search latency
- Route calculation latency
- Blip rendering performance
- Memory usage
- Battery impact where measurable

Set realistic performance budgets based on baseline measurements and supported devices.

### Tests

Include degraded-network, permission-denied, slow-device, stale-cache, and intermittent-connectivity scenarios.

### Documentation

Document caching policies, privacy controls, performance measurements, and offline limitations.

### Acceptance criteria

The mapping system remains responsive and provides understandable behavior under common network and location-permission failures.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 8 — 3D BUILDINGS AND TERRAIN

## Objective

Add practical 3D visualization without compromising the main navigation experience.

### Features

- Building extrusion from available footprints and height data
- Optional terrain visualization
- Camera tilt and rotation controls
- 2D/3D mode switching
- Route visibility in 3D
- Building selection in 3D
- Fallback rendering for unsupported devices

Do not invent building heights or imply inferred geometry is survey-accurate.

### Performance requirements

- Lazy-load optional 3D assets
- Avoid unnecessary GPU resource retention
- Handle WebGL context loss
- Provide a 2D fallback
- Respect reduced-motion preferences where relevant

### Tests

Include rendering initialization, mode switching, cleanup, unsupported graphics capabilities, and memory behavior.

### Documentation

Document supported 3D capabilities, data sources, rendering limitations, and performance requirements.

### Acceptance criteria

Users can switch between 2D and 3D building visualization without losing navigation state.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 9 — GAUSSIAN-SPLAT PROOF OF CONCEPT

## Objective

Demonstrate a photorealistic 3D campus location without requiring Gaussian splats for ordinary navigation.

### Scope

Create an isolated proof of concept for one appropriately licensed and georeferenced campus scene, if a suitable asset is available.

Do not assume such an asset exists.

### Technology evaluation

Investigate maintained Three.js-compatible Gaussian-splat rendering options.

Evaluate:

- Asset format compatibility
- Browser support
- Native compatibility
- GPU requirements
- Memory consumption
- Streaming behavior
- Compression
- Geographic alignment
- Licensing
- Accessibility and fallback behavior

### Architecture

Store 3D assets separately from the main application database.

Use object storage or an existing compatible asset delivery system.

Store metadata and geographic transforms in the database.

### Features

- Open 3D scene from a building or landmark
- Camera navigation
- Return to 2D map
- Geographic anchor alignment
- Optional entrance markers
- Loading progress
- Unsupported-device fallback

### Tests

Include:

- Asset loading
- Missing assets
- Invalid transforms
- Geographic alignment
- GPU memory usage
- Scene cleanup
- Context loss
- Device capability fallback
- Slow-network behavior

### Documentation

Document the asset capture/import pipeline, coordinate transforms, rendering architecture, supported devices, and limitations.

### Acceptance criteria

At least one real, licensed scene is rendered successfully and linked to the correct geographic location.

If no suitable scene is available, deliver a documented, testable integration foundation and classify visual validation as blocked. Do not fabricate a completed campus reconstruction.

### Final activity

Perform the required cross-device web and native verification.

---

# STAGE 10 — PRODUCTION HARDENING

## Objective

Prepare the geospatial platform for reliable deployment.

### Security

Review:

- Authentication
- Authorization
- Input validation
- SQL injection protection
- GeoJSON validation
- Rate limiting
- API key restrictions
- Cross-origin configuration
- Sensitive location data
- Report abuse prevention
- Dependency vulnerabilities

### Database

Review:

- Spatial indexes
- Query plans
- Migration safety
- Backup and restoration
- Import idempotency
- Transaction boundaries
- Database connection management

### Operations

Implement or improve:

- Structured logging
- Error monitoring
- Health checks
- Performance metrics
- Deployment documentation
- Environment configuration
- Rollback procedures
- Data import scheduling
- Tile provider outage handling

### Testing

Run:

- Complete frontend test suite
- Complete backend test suite
- Database migration tests
- Spatial integration tests
- Routing correctness tests
- Security tests
- Performance tests
- End-to-end user workflows
- Existing messaging regression tests

Do not use destructive tests against production data.

### Documentation

Produce an up-to-date operations guide and release checklist.

### Acceptance criteria

The mapping platform can be deployed, monitored, backed up, and recovered using documented procedures.

### Final activity

Perform the required cross-device web and native verification.

---

# CROSS-DEVICE TEST MATRIX

Apply this matrix at the **end of every stage**, after all other testing and documentation work.

## Web viewport sizes

| Device class | Viewport |
|---|---|
| Small mobile | 320 × 568 |
| Standard mobile | 375 × 667 |
| Large mobile | 430 × 932 |
| Tablet portrait | 768 × 1024 |
| Tablet landscape | 1024 × 768 |
| Laptop | 1366 × 768 |
| Desktop | 1920 × 1080 |
| Large desktop | 2560 × 1440 |

Use automated browser testing where supported, preferably the project's existing browser automation framework or Playwright.

Test major Chromium, Firefox, and WebKit browser engines where available.

## Native application

Detect the actual native framework and supported platforms.

Use appropriate tooling, such as:

- Xcode Simulator for iOS
- Android Emulator for Android
- Physical-device testing when devices are available
- Existing native application test infrastructure

Do not claim native testing was completed based solely on browser viewport emulation.

If native builds cannot run in the current environment, record the exact missing tools, devices, permissions, or configuration.

## Interaction tests

At minimum verify:

- Map panning
- Pinch zoom
- Mouse wheel zoom
- Keyboard navigation
- Marker selection
- Search input
- Route selection
- Modal and panel interaction
- Orientation changes
- Safe-area handling
- Touch target sizing
- No horizontal overflow
- No controls obscured by navigation bars

Capture screenshots or test artifacts when tooling supports them.

---

# DOCUMENTATION POLICY

Documentation is a required deliverable, not an optional cleanup task.

Maintain:

1. Architecture documentation.
2. API contracts.
3. Database schema documentation.
4. Migration procedures.
5. Development setup instructions.
6. Environment variable reference.
7. Testing instructions.
8. Deployment instructions.
9. Known limitations.
10. Security and privacy decisions.
11. Geographic data provenance.
12. Map provider attribution and licensing.
13. Stage-by-stage implementation history.

Whenever implementation changes a documented behavior, update the relevant documentation in the same stage.

Do not allow documentation to describe features that have not been implemented.

Maintain an implementation status document that distinguishes:

- Implemented and tested
- Implemented but not fully verified
- Planned
- Blocked
- Deferred

---

# TESTING AND QUALITY GATES

Every stage must satisfy the following gates before completion.

### Gate A — Code quality

- Code follows existing conventions.
- Formatting and linting pass.
- Type checks pass where applicable.
- No unused experimental implementation remains.
- Dependencies are justified.

### Gate B — Functional correctness

- Unit tests pass.
- Relevant integration tests pass.
- API contracts are validated.
- Error states are tested.
- Edge cases are covered.

### Gate C — Regression protection

- Existing authentication works.
- Existing messaging works.
- Existing application navigation works.
- Existing database behavior remains intact.

### Gate D — Security and performance

- New endpoints enforce appropriate permissions.
- Inputs are validated.
- Sensitive data is protected.
- Performance regressions are investigated.

### Gate E — Documentation

- Architecture is current.
- APIs are documented.
- Configuration is documented.
- Known limitations are recorded.

### Gate F — Final device verification

**This gate must always run last.**

Test responsive web layouts and native targets.

If Gate F discovers an issue, return to the appropriate earlier gate, correct the issue, and repeat Gate F last.

---

# ADDITIONAL ENGINEERING REQUIREMENTS

## Feature flags

Use feature flags or equivalent configuration to introduce major mapping capabilities without forcing unfinished functionality into production.

## Reproducible environments

Prefer pinned dependencies, committed lockfiles, and reproducible local development commands.

Use containerized test dependencies when appropriate.

## Database safety

Use Alembic or the existing migration framework.

Never use automatic schema deletion or database recreation against a populated development or production database.

## API versioning

Follow the application's existing API versioning conventions.

Avoid unnecessary breaking changes.

## Observability

Record useful metrics for route latency, search latency, tile failures, geospatial import failures, and SSE reconnections.

Do not log sensitive user location data unnecessarily.

## Geographic correctness

Use correct coordinate ordering and coordinate reference systems.

GeoJSON coordinates must follow longitude, latitude order.

Never confuse degrees with meters.

## Data licensing

Respect OSM attribution and applicable ODbL requirements.

Respect satellite imagery licensing and caching restrictions.

Record source licenses for imported geographic and 3D data.

## Test realism

Prefer real database integration tests for spatial queries and routing.

Mocks are appropriate for isolated unit tests but are insufficient to validate geographic correctness.

## Error handling

Provide meaningful user-facing error states for unavailable maps, missing locations, disconnected routes, inaccessible destinations, and network failures.

## Performance

Avoid rendering thousands of individual React marker components when vector layers or clustered GeoJSON sources are more appropriate.

Use bounding-box queries and pagination where useful.

## Accessibility

Use accessible controls, labels, focus management, sufficient contrast, and usable touch targets.

The map must not be the only way to discover a building or read route instructions.

---

# REQUIRED STAGE COMPLETION REPORT

After every stage, produce a structured report containing:

**Stage:** Number and title

**Implemented:** Exact features completed

**Files changed:** List of relevant files

**Database changes:** Migrations and schema updates

**Tests executed:** Exact commands

**Results:** Passed, failed, skipped, or blocked

**Regression status:** Existing functionality verification

**Documentation updated:** Exact files

**Final device verification:** Tested viewports, browsers, simulators, and native devices

**Known limitations:** Remaining issues

**Next stage:** Planned work

Do not report success without evidence.

---

# EXECUTION INSTRUCTIONS

Begin with Stage 0.

First inspect the repository and establish the baseline.

Then implement the remaining stages sequentially.

Work autonomously within the available environment, but do not fabricate results, bypass required testing, or perform destructive operations without authorization.

If a stage requires credentials, proprietary geographic assets, university permissions, unavailable hardware, or a major architecture decision, explain the dependency clearly and continue only with work that can be completed safely.

Do not introduce unrelated refactors.

Prefer production-quality, maintainable implementations over demonstrations that merely appear functional.

**The end goal is a reliable campus navigation platform integrated with the existing application—not a disconnected mapping prototype.**
