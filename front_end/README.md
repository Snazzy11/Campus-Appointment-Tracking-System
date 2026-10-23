# CATS frontend

An [Expo](https://docs.expo.dev) app written in React Native + TypeScript.
We are using expo so the app is portable between browsers, iOS, Android.

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

## Checks (same idea as the backend's ruff + pyright)

| Command (from repo root)  | What it does                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `make frontend-format`    | **Fixes** formatting with Prettier (quotes, spacing, line breaks).                                 |
| `make frontend-lint`      | ESLint: finds likely bugs and bad patterns.                                                        |
| `make frontend-typecheck` | TypeScript: finds type errors, e.g. a misspelled field or passing a string where a number belongs. |
| `make validate-frontend`  | Runs all three checks without changing files. **CI runs this on every PR.**                        |

Before committing, run `make frontend-format` and then `make validate-frontend`. (`make validate` checks backend and frontend together.)
The same commands work as `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm validate` from inside `front_end/`.
Settings live in `.prettierrc.json` (formatting) and `eslint.config.js` (lint rules).

## Where things go

```
src/
  app/                 Routes. Each file here is a page/URL. Keep these files tiny.
    _layout.tsx        Wraps every page (theme + tab bar)
    index.tsx          "/"           -> HomeScreen
    locations.tsx      "/locations"  -> LocationsScreen
  features/            One folder per feature. Most of your work happens here.
    home/
      HomeScreen.tsx
    locations/
      LocationsScreen.tsx   the page: holds state, loads data
      LocationItem.tsx      a piece of UI used by the page
      locationService.ts    calls to the backend for this feature
      types.ts              shapes of the data this feature uses
  shared/              Code used by more than one feature
    api.ts             backend address + getFromApi() helper
    components/        shared UI (tab bar, themed text/views)
    constants/         colors, spacing
    hooks/             shared hooks (light/dark mode)
```

Rule of thumb: if only one feature uses it, it goes in that feature's folder. If two or more do, it goes in `shared/`.

## How the Locations page gets its data

1. You open `/locations`, so Expo Router renders `src/app/locations.tsx`, which just shows `LocationsScreen`.
2. `LocationsScreen` runs `useEffect`, which calls `getLocations()` when the page first appears.
3. `getLocations()` (`locationService.ts`) calls `getFromApi('/locations')` (`shared/api.ts`).
4. That sends `GET http://localhost:8000/locations` to FastAPI (`back_end/app/api/routers/locations/locations.py`).
5. The JSON response is saved with `setLocations(...)`, the page re-draws, and each location is shown by `LocationItem`.

## Adding a new feature (example: "events")

1. **Backend:** add the endpoint and its Pydantic response model. Check it at http://localhost:8000/docs.
2. `src/features/events/types.ts`: a TypeScript type that matches the Pydantic model field for field.
3. `src/features/events/eventService.ts`: `getEvents()` using `getFromApi('/events')`.
4. `src/features/events/EventsScreen.tsx`: copy `LocationsScreen.tsx` as a starting point.
5. `src/app/events.tsx`: two lines, like `src/app/locations.tsx`.
6. To give it a tab, add it to **both** `shared/components/AppTabs.tsx` (phone) and `AppTabs.web.tsx` (browser).

## Conventions

- Components and screens: `PascalCase.tsx` with a named export (`export function LocationsScreen`).
- Everything else: `camelCase.ts`.
- Only files in `src/app/` use `export default`, because Expo Router requires it there.
- Import with `@/`, which means `src/`. For example, `import { getFromApi } from '@/shared/api'`. Inside the same feature folder, `./file` is fine.

## Things that trip people up

- **`File.web.tsx`**: on the web, Expo automatically uses `File.web.tsx` instead of `File.tsx`. That's why there are two `AppTabs` files, and a change to one isn't seen on the other platform.
- **Phones and `localhost`**: on a phone, `localhost` means the phone itself. To test on a phone, create `front_end/.env` with `EXPO_PUBLIC_API_URL=http://<your computer's LAN IP>:8000` and restart `pnpm web`/`pnpm start`. `.env` changes only apply after a restart.
- **Adding packages**: use `pnpm exec expo install <package>` (not `pnpm add`) so Expo picks versions that work with our Expo SDK. Don't use npm in this project.
- **Data looks wrong?** Check the backend first with `curl localhost:8000/locations` or http://localhost:8000/docs. If the API is right, the bug is in the frontend.
- **CORS errors in the console**: the backend only allows requests from `localhost:8081`; see `allow_origins` in `back_end/app/api/main.py`.

## Other files

- `app.json`: Expo config (app name, icons, splash screen)
- `tsconfig.json`: TypeScript config; defines the `@/` shortcut
- `pnpm-lock.yaml`: exact package versions (commit it, don't edit it)
- `pnpm build`: exports the web app into `dist/` (ignored by git)
