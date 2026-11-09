# CATS frontend

An [Expo](https://docs.expo.dev) app written in React Native + TypeScript.
We are using expo so the app is portable between browsers, iOS, Android.
We're on **Expo SDK 54** (React 19.1, React Native 0.81, Expo Router 6; see `expo` in `package.json`). Expo changes a lot between SDK versions, so check the docs for our version rather than the "latest" docs or older tutorials. docs.expo.dev no longer hosts SDK 54 pages (`/versions/v54.0.0/` links redirect to the latest docs), but the SDK 54 docs are archived on GitHub: [expo/expo/tree/sdk-54/docs/pages/versions/v54.0.0](https://github.com/expo/expo/tree/sdk-54/docs/pages/versions/v54.0.0) (one `.mdx` file per page, e.g. `sdk/map-view.mdx`). `AGENTS.md` in the repo root contains Expo's guidance for AI coding tools, and this README follows it.

> **Don't upgrade the Expo SDK** (e.g. `expo install expo@latest`). We deliberately stay on SDK 54 because it's the newest version the App Store's Expo Go supports, and nobody on the team has a Mac or a paid Apple Developer account. Upgrading would stop the app from running on iPhones. See [Mobile development](#mobile-development).

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

Each Expo Go build supports exactly one Expo SDK version, and it must match ours (**SDK 54**).

| Device                                     | Works?    | How                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **iPhone**                                 | Yes, free | Install **Expo Go** from the App Store (it runs SDK 54). On a real iPhone, Expo Go and your computer must be signed in to the **same free Expo account**: create one at [expo.dev/signup](https://expo.dev/signup), run `pnpm exec expo login` in `front_end/`, and sign in inside Expo Go (account icon, top right). Each person uses their own account. Then scan the QR code with the Camera app. |
| **Android phone**                          | Yes, free | The Play Store's Expo Go may be for a newer SDK. If it says the project is incompatible, install the **SDK 54** Expo Go from [expo.dev/go](https://expo.dev/go). Scan the QR code from inside Expo Go. No account needed.                                                                                                                                                                            |
| **Android emulator** (Windows/macOS/Linux) | Yes, free | Install [Android Studio](https://docs.expo.dev/workflow/android-studio-emulator.md), create a virtual device in Device Manager and start it, then press `a` in the `make mobile-up` terminal. Expo installs the right Expo Go automatically.                                                                                                                                                         |
| **iOS simulator** (macOS only)             | Yes, free | Install Xcode from the Mac App Store, then press `i` in the `make mobile-up` terminal. Expo installs the right Expo Go automatically.                                                                                                                                                                                                                                                                |

Phones must be on the same Wi-Fi as your computer (see below).

### Common problems

- **QR code won't load / times out:** the phone and computer must be on the same network, and campus Wi-Fi usually blocks devices from talking to each other. Use a phone hotspot or home Wi-Fi. `pnpm start --tunnel` gets the app code through, but **not** the API calls, so the Locations page will still fail.
- **App loads but Locations shows an error:** the phone can't reach port 8000. Check that the backend is running (`make health`), that your computer's firewall allows ports 8000 and 8081, and that both devices are on the same network.
- **"Project is incompatible with this version of Expo Go":** your Expo Go is for a different SDK. On Android, install the SDK 54 build from [expo.dev/go](https://expo.dev/go). On iPhone, make sure nobody upgraded `expo` in `package.json`.
- **"You need to be signed in to Expo Go and Expo CLI" (iPhone):** run `pnpm exec expo login` in `front_end/` and sign in to Expo Go with the same account, then restart `make mobile-up`. `pnpm exec expo whoami` shows who the CLI is signed in as.
- **Changes don't show up:** shake the device (or press `m` in the terminal) to open the developer menu and reload. If it's still stale, stop Expo and run `pnpm start --clear` from `front_end/`.
- **CORS only applies to browsers:** the phone app doesn't need to be added to `allow_origins`.

### Only use packages that are included in Expo Go

Expo Go can only run packages whose native code is built into it. We can't make our own builds of the app (that needs a Mac or a paid Apple account), so **every package we add must work in Expo Go**. Pure JavaScript packages (no `ios/`/`android/` folders, no native modules) always work; most UI components such as calendars, date pickers and charts are pure JavaScript. For packages with native code, look for `inExpoGo: true` at the top of the package's page in the [archived SDK 54 docs](https://github.com/expo/expo/tree/sdk-54/docs/pages/versions/v54.0.0/sdk). If a package isn't listed there and has native code, it won't run in Expo Go.

- **Maps:** use [`react-native-maps`](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/map-view.mdx) (included in Expo Go, no setup needed for testing). **Don't use `expo-maps`**: it isn't in Expo Go and needs a development build. Neither works in the browser, so the web version of the Map tab needs its own `MapScreen.web.tsx`.
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
After changing packages or `app.json`, also run `pnpm dlx expo-doctor` from `front_end/` (it should report `21/21 checks passed`). If it says packages are out of date, fix them with `pnpm exec expo install --fix`.
Settings live in `.prettierrc.json` (formatting) and `eslint.config.js` (lint rules).

## Where things go

```
src/
  app/                 Routes. Each file here is a page/URL. Keep these files tiny.
    _layout.tsx        Wraps every page (theme + tab bar)
    index.tsx          "/"           -> HomeScreen
    locations.tsx      "/locations"  -> LocationsScreen
    maps.tsx           "/maps"       -> MapScreen
  features/            One folder per feature. Most of your work happens here.
    home/
      HomeScreen.tsx
    map/
      MapScreen.tsx         placeholder for now
    locations/
      LocationsScreen.tsx   the page: holds state, loads data
      LocationItem.tsx      a piece of UI used by the page
      locationService.ts    calls to the backend for this feature
      types.ts              shapes of the data this feature uses
  shared/              Code used by more than one feature
    api.ts             backend address + getFromApi() helper
    components/        shared UI (Screen wrapper, tab bar, themed text/views)
    constants/         colors, spacing
    hooks/             shared hooks (light/dark mode)
```

Rule of thumb: if only one feature uses it, it goes in that feature's folder. If two or more do, it goes in `shared/`.
Only routes go in `src/app/`. Expo Router turns every file there into a page, so components, hooks and helpers must live elsewhere.
Don't create or edit `ios/` or `android/` folders. Expo generates them when needed; change native settings in `app.json` instead.

## How the Locations page gets its data

1. You open `/locations`, so Expo Router renders `src/app/locations.tsx`, which just shows `LocationsScreen`.
2. `LocationsScreen` runs `useEffect`, which calls `getLocations()` when the page first appears.
3. `getLocations()` (`locationService.ts`) calls `getFromApi('/locations')` (`shared/api.ts`).
4. That sends `GET http://localhost:8000/locations` (on a phone, `http://<your computer's address>:8000/locations`) to FastAPI (`back_end/cats/api/routers/locations/locations.py`).
5. The JSON response is saved with `setLocations(...)`, the page re-draws, and a `FlatList` shows each location with `LocationItem`.

## Adding a new feature (example: "events")

1. **Backend:** add the endpoint and its Pydantic response model. Check it at http://localhost:8000/docs.
2. `src/features/events/types.ts`: a TypeScript type that matches the Pydantic model field for field.
3. `src/features/events/eventService.ts`: `getEvents()` using `getFromApi('/events')`.
4. `src/features/events/EventsScreen.tsx`: copy `LocationsScreen.tsx` as a starting point. Keep the `Screen` wrapper and `ThemedText` (see Conventions).
5. `src/app/events.tsx`: two lines, like `src/app/locations.tsx`.
6. To give it a tab, add it to **both** `shared/components/AppTabs.tsx` (phone) and `AppTabs.web.tsx` (browser).

## Conventions

- Components and screens: `PascalCase.tsx` with a named export (`export function LocationsScreen`).
- Everything else: `camelCase.ts`.
- Only files in `src/app/` use `export default`, because Expo Router requires it there.
- Wrap every screen in `Screen` (`src/shared/components/Screen.tsx`). It keeps content clear of the notch, status bar and home indicator, and uses the light/dark background.
- Use `ThemedText` instead of React Native's `Text`, otherwise text stays black in dark mode.
- Use `FlatList` instead of `ScrollView` + `.map()` for lists that can get long. It only draws the rows on screen, which keeps phones fast.
- Navigate with `Link`, `router` and `useLocalSearchParams` from `expo-router`.
- Prefer Expo's own packages (`expo-image`, `expo-location`, ...) over third-party ones when both exist, as long as they're included in Expo Go (see [Mobile development](#only-use-packages-that-are-included-in-expo-go)).
- Import with `@/`, which means `src/`. For example, `import { getFromApi } from '@/shared/api'`. Inside the same feature folder, `./file` is fine.

## Things that trip people up

- **`File.web.tsx`**: on the web, Expo automatically uses `File.web.tsx` instead of `File.tsx`. That's why there are two `AppTabs` files, and a change to one isn't seen on the other platform.
- **Phones and `localhost`**: on a phone, `localhost` means the phone itself. In development the app automatically calls the backend on port 8000 of the computer running Expo (`src/shared/api.ts`), so the backend must be running on that computer (`make backend-up` or `make api-up`; see [Mobile development](#mobile-development)). To use a different backend, create `front_end/.env` with `EXPO_PUBLIC_API_URL=http://<host>:8000` and restart `pnpm web`/`pnpm start`. `.env` changes only apply after a restart.
- **Adding packages**: use `pnpm exec expo install <package>` (not `pnpm add`). We still use pnpm: `expo install` picks versions that work with our Expo SDK and then installs them with pnpm. Expo's docs write this as `npx expo install`, which does the same thing. Don't use npm or yarn to install packages in this project.
- **Data looks wrong?** Check the backend first with `curl localhost:8000/locations` or http://localhost:8000/docs. If the API is right, the bug is in the frontend.
- **CORS errors in the console**: the backend only allows requests from `localhost:8081`; see `allow_origins` in `back_end/cats/api/main.py`.

## Other files

- `app.json`: Expo config (app name, icons, splash screen)
- `tsconfig.json`: TypeScript config; defines the `@/` shortcut
- `pnpm-lock.yaml`: exact package versions (commit it, don't edit it)
- `pnpm build`: exports the web app into `dist/` (ignored by git)
