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

Stage 2 is implemented: editable username/display name/bio, image selection/upload/removal, profile avatars, updated author names in message history, and S3 support with documented setup. See deploy/PROFILES.md. Local development is isolated in campus_buildout on PostgreSQL port 5434; groupdemo's database was not migrated. Migration d8b4a21e653c has been applied only locally. Cloud deployment has not been performed. Next: stage 3, messaging inbox and responsive chat redesign. The copied private deploy settings target messaging.tufts.pro and its existing cloud database, as previously agreed.

Stage 2 verification: 48 backend tests, 18 frontend tests, 8 deployment tests, lint/typecheck, and iOS/Android/web exports passed. Local PostgreSQL migrations match the ORM schema and reject case-insensitive username collisions. A disposable browser test with mocked Cognito saved the profile and uploaded a test photo, then verified both after signing back in. Actual S3/IAM and physical iPhone selection remain environment checks.
