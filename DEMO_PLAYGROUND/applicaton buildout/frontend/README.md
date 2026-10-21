# Expo messaging frontend

The frontend now uses Expo SDK 57, React Native 0.86, React 19, TypeScript, and Expo Router. The same native components render on iOS, Android, and web. npm dependencies are resolved in `package-lock.json`; Expo compatibility checks determine React Native and expo-* package versions. The prior Vite implementation is archived in [legacy/vite](legacy/vite/README.md).

## Setup and commands

```sh
npm ci
cp .env.example .env  # only if you do not already have a .env
npm start
npm run web
npm run lint
npm run typecheck
npm test
npm run build        # Expo static web export to dist/
npx expo export --platform all
npx expo-doctor
```

`npm start` starts Metro on port 8081. With expo-dev-client installed, native launch targets the development client by default; use `npm start -- --go` for public chat in Expo Go. `npm run ios`/`android` request a local simulator/emulator through Expo start. Use `npx expo install <package>` for SDK-compatible additions. There is no Vite server/proxy, DOM entry point, or CSS-based active UI.

`EXPO_PUBLIC_API_URL` is the absolute backend base URL (no trailing /api), e.g. `http://localhost:8000`. It is bundled public configuration; never put database credentials or client secrets in EXPO_PUBLIC variables. Physical phones need a reachable LAN IP and backend bound to 0.0.0.0. Android emulator uses 10.0.2.2. Metro must be restarted/reloaded after configuration changes. HTTPS is expected for deployed API access.

## Files and navigation

| File | Responsibility |
| --- | --- |
| src/app/_layout.tsx | SafeAreaProvider, AuthProvider, Expo Router Stack |
| src/app/(tabs)/index.tsx | Messaging screen; account-keyed remount clears private state on login/logout/account change |
| src/app/auth/callback.tsx | Web code exchange, session establishment, error feedback, and return navigation |
| src/screens/MessagingScreen.tsx | Responsive inbox/chat layout, separate drafts, recipient dialog, history, connection/error state |
| src/components/LoginButton.tsx | Cognito PKCE request; same-tab web navigation and native AuthSession |
| src/context/AuthContext.tsx | Restore account/session, sign-in, logout, expiry clearing |
| src/services/api.ts | Absolute API URL, bearer headers, typed JSON requests and API errors |
| src/services/session.ts | Native SecureStore; memory-only web session |
| src/services/web-auth.ts | Tab-scoped pending PKCE transaction and validated callback consumption |
| src/services/stream.ts | expo/fetch streaming, AbortController cleanup, reconnect loop |
| src/services/sse-parser.ts | Partial-frame parser for public and named private events |

Route files remain in src/app; reusable code lives outside it. `main` is `expo-router/entry`. `app.json` declares the native URI scheme and Router/SecureStore/WebBrowser plugins; `eas.json` supplies development, preview, and production profiles. Generated native directories are ignored; native configuration belongs in app.json/config plugins.

## Authentication

The screen fetches public Cognito metadata from `/api/auth/config`. AuthSession prepares an authorization-code request with S256 PKCE, `openid email profile`, and a generated state. Its return URI is `campusmessaging://auth/callback` in installed/development builds, or the current web origin plus `/auth/callback`.

On web, login navigates the current tab to Cognito. A pending state/verifier/redirect/time record stays temporarily in sessionStorage; the callback consumes it once, checks state, exact origin/path, and a ten-minute expiry, removes OAuth query values from browser history, and posts code/verifier/redirect URI to `/api/auth/session`. After account/session establishment it replaces the callback route with chat. This does not depend on a popup opener or cross-window messaging. Missing/expired transactions and provider/backend failures are displayed with a return link. StrictMode reuses the in-flight exchange instead of redeeming a code twice. Native sign-in keeps AuthSession; its successful result must match request state and contain a verifier, then the login button posts the exchange. The backend exchanges and verifies the token server-side. The client receives an opaque session, calls `/api/me` to obtain account/numeric user ID, and stores the session with SecureStore on native platforms. On web the session stays in memory; reload intentionally signs out the app, though the Cognito browser session can make the next login quick. Temporary PKCE transaction data is consumed/removed on callback; application session tokens are not stored in browser sessionStorage.

Native sign-in requires a development build; Expo Go cannot own the custom callback scheme. Login in Expo Go shows an explanatory error while public chat remains usable. The custom/native and web callback URLs must be registered in Cognito and the backend allowlist. `expo-dev-client` is installed; use `npx eas-cli@latest build --profile development --platform android|ios` (replace android|ios with one platform), then `npm start -- --dev-client`.

`/api/auth/logout` revokes the bearer session and clears storage/account state. If the API is unreachable, logout still clears local storage/account state and explains that server revocation could not complete; the process-local server session expires automatically. It does not sign out the Cognito hosted browser session. A 401 from private requests/streams clears the expired account. Restore keeps a saved token on a transient network failure so another launch can retry. No refresh-token flow exists; sessions last eight hours and disappear on backend restart.

## Message state and UI

The UI uses SafeAreaView, KeyboardAvoidingView, native TextInput/Pressable, horizontal chat choices, and a virtualized FlatList. Signed-in users find a recipient by email prefix and tap a suggestion to open a DM. The picker sends the selected numeric ID internally. Backend membership, not client display logic, controls access.

`activeId === null` selects public chat. Separate public history and a map of private histories prevent switching chats from applying another chat's response to the visible list. Histories merge by numeric ID, sort ascending, and cap local retention at 500 rows per chat. Selection/loading flags are set by user actions. Selection clears the draft; requests merge only into their intended chat cache. A ref tracks current selection when an in-flight send finishes. A synchronous ref lock prevents duplicate send submissions before React re-renders.

The composer trims text and blocks empty messages. Native/web input and backend both allow 5000 characters. Returned POST rows merge immediately; later SSE duplicates are deduplicated. The exact original draft is cleared only if the user has not changed it and the selected chat still matches. Pending sends disable editing. Own-message bubbles use user ID when present or sender email for public messages. The FlatList scrolls to the end when content size changes.

## Live delivery and reconnect recovery

Expo's cross-platform `expo/fetch` exposes a readable response stream. The transport sends Accept: text/event-stream and optional Authorization headers; it never puts session tokens into URLs. A UTF-8 decoder preserves characters across chunks. The parser buffers partial frames, handles LF/CRLF boundaries, joins multiple data lines, ignores comments, and distinguishes ordinary `message` from named `private_message` events.

Public history loads at startup and on stream open. Private stream opens only when signed in, refreshes the conversation list, and reloads the selected private history on reconnect. Private events update the appropriate cache even if another chat is selected and refresh conversations. Selecting a private chat requests latest-100 history. The backend does not send old messages over SSE.

Streams reconnect after two seconds on network errors/EOF. A private 401 ends retries and expires the account. AbortController, reader cancellation, and retry-timer cleanup stop inactive effects. AppState backgrounding closes subscriptions; foregrounding opens fresh streams and reloads histories. Stream flags show Live/Connecting/Paused; the Refresh action reopens streams and refetches state/config. No background notification delivery is implemented.

Recovery can only retrieve the latest 100 rows per history endpoint; longer offline gaps can omit older unseen messages. Conversation creation alone emits no event until a private message is sent. Conversation list ordering is by creation time, not activity, and there are no unread counts. The email directory is available through authenticated prefix search.

## Verification and device checks

Lint and strict TypeScript checks run against the active Expo source; archived files are ignored. `npm test` also covers successful web callback exchange, state/duplicate-state validation, callback origin checks, missing codes, provider rejection, expiry, and backend failures. `npm test` exercises SSE frames split across chunks, Unicode text, comments, named/default events, CRLF boundaries, and multiline payloads. It also renders the messaging screen with the actual React Native Web components for anonymous and signed-in users and rejects raw-text children inside View when error strings are empty. Expo Doctor checks SDK/config compatibility; all-platform export checks Android/iOS JS bundles and static web routes.

On a configured instance, check public chat from two clients, account restore, two-account DM creation/reuse, outsider rejection, reconnect/foreground recovery, logout, and keyboard/safe-area behavior on actual phones. Bundle checks do not validate OS browser callbacks or device network reachability. Real Cognito/account setup and native signed builds were not performed by this migration.

References: [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [AuthSession](https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/), [streaming fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/), [SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).

## Metro watcher troubleshooting

The local macOS development-server check hit `EMFILE: too many open files, watch`; export mode still bundles successfully. If this occurs, install [Watchman](https://facebook.github.io/watchman/docs/install) and restart Metro (`npm start -- --clear`). The default Metro configuration is retained; inspection showed no extra watchFolders for this project. A signed build/device runtime and an interactive browser runtime were not verified in this environment.

## Local iPhone build with a free Apple ID

Xcode can sign and install a development build using your Apple ID's Personal Team. Add the account in Xcode Settings → Apple Accounts, connect and unlock the iPhone, accept its Trust prompt, and enable Developer Mode when Xcode/iOS requests it. Xcode's Devices and Simulators window must show the phone as connected and ready.

With a compatible Xcode and CocoaPods installed, run from frontend/:

```sh
npx expo run:ios --device
```

Expo generates the ignored native project from app.json, installs pods, and builds for a selected device. If signing needs configuration, open ios/CampusMessaging.xcworkspace (after pod installation), choose the CampusMessaging app target → Signing & Capabilities, and select your Personal Team with automatic signing. A bundle identifier registered by another team must be replaced with your own unique identifier in app.json, followed by prebuild regeneration.

After installation, start Metro with `npm start -- --dev-client --lan` and keep FastAPI reachable at EXPO_PUBLIC_API_URL. The native Cognito callback remains campusmessaging://auth/callback and must be allowed by Cognito. Successful native login navigates back to chat after establishing the session.

## Recipient picker

`RecipientPicker.tsx` replaces the numeric recipient input. At least three trimmed characters are required. The `recipient-search.ts` controller debounces 300 ms, cancels superseded fetches, clears old results immediately, and ignores out-of-order responses even if an abort is not honored. It exposes loading, no-match, verification/rate-limit, and network-error states. A 401 expires the account. Suggestions return only email/ID and use accessible buttons and an email keyboard; selecting one creates or reuses a DM. Session changes remount the picker to clear private directory state.

Search uses `/api/users/search?q=<encoded-prefix>` with a bearer session. Matching is case-insensitive and literal, not fuzzy. Only verified, uniquely identified email accounts appear; self is excluded. Existing accounts may need to sign in again after the migration. Conversation opening has a synchronous lock to prevent double-tap submissions.


## Messaging inbox and chat layout

`ConversationInbox.tsx` renders search/filter controls and previews. `ChatMessage.tsx` renders message bubbles, profile identities, dates, and group status events. Pure inbox/draft behavior lives in `services/inbox.ts` and is covered by Node tests.

Below 840px, selecting a conversation opens the chat with an Inbox return button; Android hardware back returns to the inbox while the tab is focused. At larger widths, both panels are visible. Top-level navigation continues through Expo Router. Drafts and chat selection survive tab switches; account changes remount all private state. Drafts are not persisted to disk. Search includes conversation names and member names/emails, not message contents.

The optional API `last_message` supplies a 160-character preview before private history is opened. Cached/live messages supersede older previews. Private rows sort by activity; Public chat stays at the top in All. Unread state and delivery/read receipts are not implemented.


## Campus maps

The Maps tab uses platform-specific MapLibre components under src/features/maps. Maps default off until EXPO_PUBLIC_MAPS_ENABLED=true and licensed styles/public provider keys are supplied. See [provider setup](../docs/geospatial/PROVIDER-SETUP.md) and [stage status](../docs/geospatial/STATUS.md). Native MapLibre requires rebuilding the development app; Expo Go is not supported for the map. The platform has not been enabled in production, and building search/routing are not implemented yet.
