# CATS frontend

Standalone Expo SDK 57 application. The current UI is the Home/Explore starter; it does not yet connect to the Python backend.

## Run

Use Node.js 22.13 or newer and pnpm 11.25.0. From the repository root:

```sh
cd front_end
pnpm install --frozen-lockfile
pnpm web
```

Open the localhost URL printed by Expo. No database, Docker, Python process, or environment variables are needed for these starter screens.

After installation, `pnpm web` also works from the repository root through its forwarding script. Use `pnpm start` for the Expo development menu, `pnpm ios` for an iOS simulator, or `pnpm android` for an Android emulator. Native testing requires the corresponding platform tools and a compatible Expo client.

## Validate

```sh
pnpm lint
pnpm typecheck
pnpm build
```

`build` exports the web application into ignored `dist/`.

## Layout

- `src/app/`: Expo Router screens and layout
- `src/components/`, `src/hooks/`, `src/constants/`: shared UI code
- `assets/`: icons and images
- `app.json`: Expo application configuration
- `tsconfig.json`: TypeScript configuration; `@/` resolves to `src/`
- `pnpm-lock.yaml`: authoritative frontend dependency lockfile

Use `pnpm exec expo install <package>` for Expo/React Native dependencies. Avoid mixing npm and pnpm lockfiles. `pnpm reset-project` is an optional destructive starter-reset utility; it is not needed for normal setup.
