# Application buildout plan

Active workspace: `messaging_platform/applicaton buildout` (spelling and space as requested).
Source baseline: sibling `groupdemo`, including groups and the corrected EC2 deployment tooling.

## Agreed order

1. Navigation shell: Schedule, Maps, Messaging, and RSO as persistent main destinations. Keep Schedule, Maps, and RSO as clearly labeled placeholder screens. Add a top-right profile entry point across sections.
2. Profiles: editable username, display name, profile photo, and short bio. Extend the existing user model, retain stable user/Cognito IDs, enforce ownership and username uniqueness, and store images outside PostgreSQL with references in the user table.
3. Messaging redesign: conversation inbox, chat detail screen, and an adaptive list/detail layout for larger screens. Define shared colors, typography, spacing, and reusable components.
4. End-to-end tests and accessibility: two-user group flows, profile editing, PostgreSQL migration/concurrency checks, reconnect/expiry/send failures, keyboard navigation, screen readers, large text, and physical iPhone checks. Add relevant tests while implementing each feature as well.
5. Unread counts and notifications: unread state and notification preferences before broader notification delivery.

## Design references

- Apple Human Interface Guidelines for iPhone interaction/navigation.
- Material Design 3 for Android conventions.
- WCAG 2.2 AA as the web accessibility target.

## Current status

Stage 1 (navigation shell) is implemented:

- Four labeled Expo Router tabs: Schedule, Maps, Messaging, RSO. Messaging remains at `/`, preserving the Cognito return route.
- Schedule, Maps, and RSO have explicit Coming soon screens.
- Every tab includes an accessible top-right profile button with an email-initial fallback.
- `/profile` displays the signed-in email and sign-out action, or directs guests to Messaging to sign in. Done returns to the previously selected section. Editable profile fields and uploads are now implemented in stage 2.
- Messaging stays mounted across tab switches, preserves its draft/selection, and resets private state when the signed-in account changes. Chat keyboard avoidance accounts for the navigation header.
- Frontend dependencies are installed. Lint, TypeScript, 15 frontend tests, and iOS/Android/web exports passed. Browser checks exercised the four tabs and profile open/close. Actual iPhone keyboard/navigation and authenticated profile sign-out still need device validation.

Stage 2 is implemented: editable username/display name/bio, image selection/upload/removal, profile avatars, updated author names in message history, and S3 support with documented setup. See deploy/PROFILES.md. Local development is isolated in campus_buildout on PostgreSQL port 5434; groupdemo's database was not migrated. Migration d8b4a21e653c has been applied only locally. Cloud deployment has not been performed. Stage 3 is implemented below. The copied private deploy settings target messaging.tufts.pro and its existing cloud database, as previously agreed.

Stage 2 verification: 48 backend tests, 18 frontend tests, 8 deployment tests, lint/typecheck, and iOS/Android/web exports passed. Local PostgreSQL migrations match the ORM schema and reject case-insensitive username collisions. A disposable browser test with mocked Cognito saved the profile and uploaded a test photo, then verified both after signing back in. Actual S3/IAM and physical iPhone selection remain environment checks.


Stage 3 is implemented: searchable conversations with All/Direct/Groups filters, latest-message previews and activity ordering, a focused chat view below 840px, and two panes on larger screens. Chats show profile names/avatars, sent/received bubbles, date separators, and centered group status updates. New direct messages use a recipient-search dialog; group membership and ownership controls remain available from Details.

Drafts are separate for public chat and each private conversation while the app stays open, including tab switches. A completed send clears only its matching draft; newer edits survive. Drafts are memory-only and disappear on full reload, logout, or account change. Removed group members lose cached history and drafts. Search matches conversation names and participant names/emails, not message bodies. Unread badges and notifications are not implemented yet.

The conversations API includes a bounded latest-message preview for authorized members, using the existing message index. No database migration is required for this stage. Older backends remain usable but cannot show private previews until history is loaded. Static web rendering starts consistently and adapts after hydration.

Stage 3 verification: 50 backend tests and 24 frontend tests pass, as do Ruff, Expo lint, TypeScript, and iOS/Android/web exports. Disposable browser QA with mocked Cognito checked desktop/mobile layouts, draft switching/sending, activity ordering, inbox search, and recipient suggestions. Physical iPhone keyboard, safe-area, VoiceOver, and real multi-device reconnect testing remain stage 4 work. Cloud deployment has not been performed.


Cloud follow-up (2026-10-13): released application buildout to messaging.tufts.pro as `20261013T193555Z-31dbc0be`, retaining the existing database. Added the project-local persistent avatar volume, fixed explicit disk storage under HTTPS, expired legacy app cookies on logout, and added Cognito browser logout plus reauthentication requests. Cognito sign-out URLs were added by the user and the web logout redirect was verified. The host's messaging-only Nginx upload limit was raised from 1m to 7m after a backup and successful nginx configuration test. 51 backend tests, 25 frontend tests, 8 deployment tests, four volume-guard cases, all platform exports, cloud health, and a non-root storage write/read smoke check passed. Real account photo selection and physical iPhone logout still need user/device verification.

## Term-based class schedules

The Schedule placeholder is now a private calendar with additive CSV import and review. Fall/Spring/Summer terms are hidden after their configured end date. See [Schedule setup, CSV format, and verification](docs/schedule/README.md). The local database migration is applied; this work has not been deployed to EC2.
