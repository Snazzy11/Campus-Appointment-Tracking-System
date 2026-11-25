# CATS frontend

An [Expo](https://docs.expo.dev) app written in React Native + TypeScript.
We are using expo so the app is portable between browsers, iOS, Android.
We're on **Expo SDK 58** (React 19.3, React Native 0.88, Expo Router 58; see `expo` in `package.json`). Expo changes a lot between SDK versions, so use the [SDK 58 docs](https://docs.expo.dev/versions/v58.0.0/) rather than the "latest" docs or older tutorials. `AGENTS.md` in the repo root contains Expo's guidance for AI coding tools, and this README follows it.

> **SDK upgrades go on their own branch.** Run `pnpm exec expo install expo@<version>`, then `pnpm exec expo install --fix` and `pnpm dlx expo-doctor`, and fix anything `make validate-frontend` reports. Changing the SDK means everyone needs a matching Expo Go (see [Which device can I use?](#which-device-can-i-use)), so tell the team before merging.

We use [EAS](https://docs.expo.dev/eas/) to build and distribute the app. Because the App Store's Expo Go stops at SDK 54, iPhones run the app through TestFlight, which needs an Apple Developer Program membership (the team can get funding for one).

TODO: Add frontend validation to git pre commit and push, but cant do it until everyone has frontend stuff installed

## Run it

Needs Node.js 22.13+ and pnpm 11.25.0. Run these from the repository root:

```sh
make backend-up                                  # start the API + database (Docker)
uv run python scripts/import_osm_locations.py    # first time only: load campus locations
make setup-frontend                              # install frontend packages (after any package.json change)
pnpm web                                         # start the app, then open http://localhost:8081
```

Saving a file reloads the app automatically. If something looks wrong, open the browser devtools and use the Console and Network tabs for debugging.

To run it on a phone or emulator instead, see [Mobile development](#mobile-development).

## Mobile development

The browser (`pnpm web`) is the quickest way to work, but the app's main target is phones. Check every change on at least one phone or emulator before opening a PR. Some things, such as the tab bar, safe areas and anything using `Platform`/`*.web.tsx`, look different there.

### How it works

`make mobile-up` (same as `pnpm start` in `front_end/`) starts Expo's dev server on your computer (port 8081) and prints a QR code. The phone or emulator downloads the app's JavaScript from that server and runs it inside **Expo Go**, a free app that can run Expo projects without building our own app. Saving a file reloads the app on the device.

The app then needs a second connection, to our API on port 8000:

```
phone ──(1) app code, port 8081────▶ your computer  (make mobile-up)
phone ──(2) API requests, port 8000─▶ your computer  (make backend-up)
```

On a phone, `localhost` means the phone itself. During development `src/shared/api.ts` automatically uses the address of the computer running Expo instead, so you don't need to configure anything. To point the app at a different backend, create `front_end/.env` with `EXPO_PUBLIC_API_URL=http://<host>:8000` and restart Expo.

### Run it

From the repository root:

```sh
make backend-up   # API + database; accepts connections from your Wi-Fi
make mobile-up    # Expo dev server; shows a QR code
```

Then pick one of the options below.

### Which device can I use?

Each Expo Go build supports exactly one Expo SDK version, and it must match ours (**SDK 58**).

| Device                                     | Works?         | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **iPhone**                                 | Via TestFlight | **Don't use the App Store's Expo Go**: it only runs SDK 54. Someone with access to the team's Apple Developer account builds an SDK 58 Expo Go with `pnpm dlx eas-cli go` (from `front_end/`) and adds you to the TestFlight internal team ([guide](https://expo.fyi/deploy-expo-go-testflight)). Install it from the **TestFlight** app. Expo Go and your computer must be signed in to the **same Expo account**: create one at [expo.dev/signup](https://expo.dev/signup), run `pnpm exec expo login` in `front_end/`, and sign in inside Expo Go (account icon, top right). Then scan the QR code with the Camera app. |
| **Android phone**                          | Yes, free      | If the Play Store's Expo Go says the project is incompatible, install the **SDK 58** Expo Go from [expo.dev/go](https://expo.dev/go). Scan the QR code from inside Expo Go. No account needed.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Android emulator** (Windows/macOS/Linux) | Yes, free      | Install [Android Studio](https://docs.expo.dev/workflow/android-studio-emulator.md), create a virtual device in Device Manager and start it, then press `a` in the `make mobile-up` terminal. Expo installs the right Expo Go automatically.                                                                                                                                                                                                                                                                                                                                                                               |
| **iOS simulator** (macOS only)             | Yes, free      | Install Xcode from the Mac App Store, then press `i` in the `make mobile-up` terminal. Expo installs the right Expo Go automatically.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Phones must be on the same Wi-Fi as your computer (see below).

### Common problems

- **QR code won't load / times out:** the phone and computer must be on the same network, and campus Wi-Fi usually blocks devices from talking to each other. Use a phone hotspot or home Wi-Fi. `pnpm start --tunnel` gets the app code through, but **not** the API calls, so Saved places (the only screen that uses the backend so far) will still fail.
- **App loads but Saved places shows an error:** the phone can't reach port 8000. Check that the backend is running (`make health`), that your computer's firewall allows ports 8000 and 8081, and that both devices are on the same network.
- **"Project is incompatible with this version of Expo Go":** your Expo Go is for a different SDK. On Android, install the SDK 58 build from [expo.dev/go](https://expo.dev/go). On iPhone, use the team's TestFlight Expo Go, not the App Store one. If the SDK was upgraded, the TestFlight build has to be rebuilt with `eas go`.
- **"You need to be signed in to Expo Go and Expo CLI" (iPhone):** run `pnpm exec expo login` in `front_end/` and sign in to Expo Go with the same account, then restart `make mobile-up`. `pnpm exec expo whoami` shows who the CLI is signed in as.
- **Changes don't show up:** shake the device (or press `m` in the terminal) to open the developer menu and reload. If it's still stale, stop Expo and run `pnpm start --clear` from `front_end/`.
- **CORS only applies to browsers:** the phone app doesn't need to be added to `allow_origins`.

### Prefer packages that are included in Expo Go

Expo Go can only run packages whose native code is built into it. Day-to-day development happens in Expo Go, so **prefer packages that work there**. Pure JavaScript packages (no `ios/`/`android/` folders, no native modules) always work; most UI components such as calendars, date pickers and charts are pure JavaScript. For packages with native code, look for `inExpoGo: true` (or "Included in Expo Go") at the top of the package's page in the [SDK 58 docs](https://docs.expo.dev/versions/v58.0.0/). If a package isn't listed there and has native code, it won't run in Expo Go.

A package that isn't in Expo Go is still possible, but then everyone needs a **development build** of our app made with EAS (`eas build --profile development`), and iPhones need it through TestFlight. Talk to the team before adding one.

- **Maps:** use [`react-native-maps`](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/) (included in Expo Go, no setup needed for testing). **Don't use `expo-maps`**: it isn't in Expo Go and needs a development build. Neither works in the browser, so if the Map tab switches to a real map, the web version will need its own `MapScreen.web.tsx`. (Today the Map tab is an illustration drawn with plain Views, which works everywhere.)
- Never create or edit `ios/` or `android/` folders by hand; native settings go in `app.json`.

## Checks (same idea as the backend's ruff + pyright)

| Command (from repo root)  | What it does                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `make frontend-format`    | **Fixes** formatting with Prettier (quotes, spacing, line breaks).                                 |
| `make frontend-lint`      | ESLint: finds likely bugs and bad patterns.                                                        |
| `make frontend-typecheck` | TypeScript: finds type errors, e.g. a misspelled field or passing a string where a number belongs. |
| `make validate-frontend`  | Runs all three checks without changing files. **CI runs this on every PR.**                        |

Before committing, run `make frontend-format` and then `make validate-frontend`. (`make validate` checks backend and frontend together.)
The same commands work as `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm validate` from inside `front_end/`.
After changing packages or `app.json`, also run `pnpm dlx expo-doctor` from `front_end/` (it should report `20/20 checks passed`). If it says packages are out of date, fix them with `pnpm exec expo install --fix`.
Settings live in `.prettierrc.json` (formatting) and `eslint.config.js` (lint rules).

## Where things go

```
src/
  app/                      Routes. Each file here is a page/URL. Keep these files tiny.
    _layout.tsx             Wraps every page (theme + Stack)
    index.tsx               "/"                      -> WelcomeScreen
    sign-in.tsx             "/sign-in"               -> SignInScreen
    create-account.tsx      "/create-account"        -> CreateAccountScreen
    book-appointment.tsx    "/book-appointment"      -> BookAppointmentScreen
    appointment-confirmed.tsx                        -> AppointmentConfirmedScreen
    organizations/[organizationId].tsx               -> OrganizationDetailScreen
    (tabs)/                 Everything with the bottom tab bar. "(tabs)" is not part of the URL.
      _layout.tsx           The tabs (shared/components/AppTabs.tsx): bottom bar on phones, sidebar on wide screens
      home.tsx, map.tsx, schedule.tsx, clubs.tsx, settings.tsx
      saved-places.tsx      Inside the tabs (so the bar shows) but has no tab button
  features/                 One folder per feature. Most of your work happens here.
    locations/
      SavedPlacesScreen.tsx the page: holds state, loads data
      locationService.ts    calls to the backend for this feature (real GET /locations)
      types.ts              shapes of the data this feature uses
    auth/ booking/ clubs/ home/ map/ schedule/ settings/ welcome/
                            same idea: Screen, feature-only components, <feature>Service.ts, types.ts
  shared/                   Code used by more than one feature
    api.ts                  backend address + getFromApi() helper
    components/             shared UI: Screen, ScreenHeader, Button, TextField, HeroCard, ActionRow, ...
    constants/theme.ts      ALL design tokens: colors (light + dark), spacing, text styles, sizes
    dates.ts                turns "2026-11-18" / "13:00" into text like "Wednesday, November 18"
    fakeBackend.ts          helpers for services that return fake data (see below)
    navigation.ts           goBackOr() and enterApp()
    hooks/                  shared hooks (light/dark mode, useIsWideScreen)
    themePreference.tsx     the Settings → Appearance choice (System / Light / Dark), shared with the whole app
```

Rule of thumb: if only one feature uses it, it goes in that feature's folder. If two or more do, it goes in `shared/`.
Only routes go in `src/app/`. Expo Router turns every file there into a page, so components, hooks and helpers must live elsewhere.
Don't create or edit `ios/` or `android/` folders. Expo generates them when needed; change native settings in `app.json` instead.
The design these screens come from is in Figma; the spec and tokens are in `data/figma/`. Open tasks are in `FRONTEND_TASKS.md`.

## Real data and fake data

Every screen gets its data by calling a function in its feature's `<feature>Service.ts`. Screens never know whether that data came from the backend.

- **Real:** `locationService.ts` calls `GET /locations`. Saved places uses it to look up the real buildings.
- **Fake:** every other service returns sample data from the design, because the backend has no endpoint for it yet. Each of those files says so in a comment at the top. They call `simulateRequest()` from `shared/fakeBackend.ts`, which waits a moment like a real request.
- **To see every error state:** set `SIMULATE_FAKE_BACKEND_ERRORS = true` in `shared/fakeBackend.ts` (set it back before committing). To see Saved places' error state, stop the backend.
- **To connect a feature to the backend:** change only its service file to use `getFromApi(...)`, and make `types.ts` match the Pydantic model. See `FRONTEND_TASKS.md`.

## How Saved places gets its data

1. You open `/saved-places`, so Expo Router renders `src/app/(tabs)/saved-places.tsx`, which just shows `SavedPlacesScreen`.
2. `SavedPlacesScreen` runs `useEffect`, which calls `getSavedPlaces()` when the page first appears.
3. `getSavedPlaces()` (`locationService.ts`) calls `getLocations()`, which calls `getFromApi('/locations')` (`shared/api.ts`).
4. That sends `GET http://localhost:8000/locations` (on a phone, `http://<your computer's address>:8000/locations`) to FastAPI (`back_end/cats/api/routers/locations/locations.py`).
5. `getSavedPlaces()` picks out the saved buildings ("CMU Park Library", "Bovee University Center") by name. The screen saves the result with `setPlaces(...)`, sets `status` to `'ready'`, and re-draws.
6. If the request fails, `status` becomes `'error'` and the screen shows a "Try again" button. Pressing it adds 1 to `loadCount`, which makes the `useEffect` run again.

## Adding a new feature (example: "events")

1. **Backend:** add the endpoint and its Pydantic response model. Check it at http://localhost:8000/docs.
2. `src/features/events/types.ts`: a TypeScript type that matches the Pydantic model field for field.
3. `src/features/events/eventService.ts`: `getEvents()` using `getFromApi('/events')`.
4. `src/features/events/EventsScreen.tsx`: copy `ClubsScreen.tsx` as a starting point (it has loading, empty and error states). Keep the `Screen` wrapper and `ThemedText` (see Conventions).
5. `src/app/events.tsx` (or `src/app/(tabs)/events.tsx` to show the tab bar): two lines, like the other route files.
6. To give it a tab button, add a `<Tabs.Screen>` to `shared/components/AppTabs.tsx`. The same file is used on phones and in the browser.

## Conventions

- Components and screens: `PascalCase.tsx` with a named export (`export function ClubsScreen`).
- Everything else: `camelCase.ts`.
- Only files in `src/app/` use `export default`, because Expo Router requires it there.
- Wrap every screen in `Screen` (`src/shared/components/Screen.tsx`). It keeps content clear of the notch, status bar and home indicator, and uses the light/dark background.
- Use `ThemedText` instead of React Native's `Text`, otherwise text stays black in dark mode. Get colors with `const theme = useTheme();` so they follow Settings → Appearance (System / Light / Dark); never call React Native's `useColorScheme` directly. Pick a design text style with `type` (e.g. `type="title"`).
- Never type a color, size or font into a style. Use the tokens in `shared/constants/theme.ts` (`theme.primary`, `Spacing.lg`, `Radius.card`, ...). If a value is missing, add a token there first.
- Every screen that loads data shows a loading state, an empty state and an error state with "Try again".
- **Phones and wide screens:** the app must work well in a laptop browser too. From 768px wide (`Breakpoints.wide` in `theme.ts`) the tabs become a sidebar and screens can use more room:
  - Pick how wide a screen's content may get with `<Screen width="form" | "reading" | "wide">` (480 / 760 / 1100 px). Forms use `form`, one-column screens `reading` (the default), screens with columns or grids `wide`.
  - Use `<CardGrid>` for lists of cards: one column on phones, two on wide screens.
  - For anything else, `const isWide = useIsWideScreen();` and pick a different style, e.g. `flexDirection: 'row'` (see `HomeScreen.tsx` and `MapScreen.tsx`).
  - Check every change at phone width **and** in a wide browser window.
- Use `FlatList` instead of `ScrollView` + `.map()` for lists that can get long. It only draws the rows on screen, which keeps phones fast.
- Navigate with `Link`, `router` and `useLocalSearchParams` from `expo-router`.
- Prefer Expo's own packages (`expo-image`, `expo-location`, ...) over third-party ones when both exist, as long as they're included in Expo Go (see [Mobile development](#only-use-packages-that-are-included-in-expo-go)).
- Import with `@/`, which means `src/`. For example, `import { getFromApi } from '@/shared/api'`. Inside the same feature folder, `./file` is fine.

## Things that trip people up

- **`File.web.tsx`**: on the web, Expo automatically uses `File.web.tsx` instead of `File.tsx`, so a change to one isn't seen on the other platform. (`useColorScheme` has a web version.)
- **Hiding a route from the tab bar**: use `tabBarButton: () => null`, not `href: null`. In Expo Router 58, `href: null` makes the tab "hidden", and hidden tabs redirect to the first tab when opened.
- **Phones and `localhost`**: on a phone, `localhost` means the phone itself. In development the app automatically calls the backend on port 8000 of the computer running Expo (`src/shared/api.ts`), so the backend must be running on that computer (`make backend-up` or `make api-up`; see [Mobile development](#mobile-development)). To use a different backend, create `front_end/.env` with `EXPO_PUBLIC_API_URL=http://<host>:8000` and restart `pnpm web`/`pnpm start`. `.env` changes only apply after a restart.
- **Adding packages**: from inside `front_end/`, run `pnpm exec expo install <package>` (not `pnpm add`). From the repo root, use `pnpm --dir front_end exec expo install <package>`. Running it from the root without `--dir` fails with `Command "expo" not found`. We still use pnpm: `expo install` picks versions that work with our Expo SDK and then installs them with pnpm. Expo's docs write this as `npx expo install`, which does the same thing. Don't use npm or yarn to install packages in this project.
- **Data looks wrong?** Check the backend first with `curl localhost:8000/locations` or http://localhost:8000/docs. If the API is right, the bug is in the frontend.
- **CORS errors in the console**: the backend only allows requests from `localhost:8081`; see `allow_origins` in `back_end/cats/api/main.py`.

## Other files

- `app.json`: Expo config (app name, icons, splash screen)
- `tsconfig.json`: TypeScript config; defines the `@/` shortcut
- `pnpm-lock.yaml`: exact package versions (commit it, don't edit it)
- `pnpm build`: exports the web app into `dist/` (ignored by git)
