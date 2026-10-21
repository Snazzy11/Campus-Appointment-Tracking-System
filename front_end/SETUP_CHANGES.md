# Frontend setup changes
Paths below are relative to the repository root. These changes make the existing starter a standalone Expo SDK 57 app; they do not import the demo applications.
## Source moves (contents preserved except subsequent fixes listed below)
- `front_end/app/_layout.tsx` → `front_end/src/app/_layout.tsx`
- `front_end/app/explore.tsx` → `front_end/src/app/explore.tsx`
- `front_end/app/index.tsx` → `front_end/src/app/index.tsx`
- `front_end/components/animated-icon.module.css` → `front_end/src/components/animated-icon.module.css`
- `front_end/components/animated-icon.tsx` → `front_end/src/components/animated-icon.tsx`
- `front_end/components/animated-icon.web.tsx` → `front_end/src/components/animated-icon.web.tsx`
- `front_end/components/app-tabs.tsx` → `front_end/src/components/app-tabs.tsx`
- `front_end/components/app-tabs.web.tsx` → `front_end/src/components/app-tabs.web.tsx`
- `front_end/components/external-link.tsx` → `front_end/src/components/external-link.tsx`
- `front_end/components/hint-row.tsx` → `front_end/src/components/hint-row.tsx`
- `front_end/components/themed-text.tsx` → `front_end/src/components/themed-text.tsx`
- `front_end/components/themed-view.tsx` → `front_end/src/components/themed-view.tsx`
- `front_end/components/ui/collapsible.tsx` → `front_end/src/components/ui/collapsible.tsx`
- `front_end/components/web-badge.tsx` → `front_end/src/components/web-badge.tsx`
- `front_end/constants/theme.ts` → `front_end/src/constants/theme.ts`
- `front_end/global.css` → `front_end/src/global.css`
- `front_end/hooks/use-color-scheme.ts` → `front_end/src/hooks/use-color-scheme.ts`
- `front_end/hooks/use-color-scheme.web.ts` → `front_end/src/hooks/use-color-scheme.web.ts`
- `front_end/hooks/use-theme.ts` → `front_end/src/hooks/use-theme.ts`

## Assets and configuration moves
- `assets/expo.icon/Assets/expo-symbol 2.svg` → `front_end/assets/expo.icon/Assets/expo-symbol 2.svg`
- `assets/expo.icon/Assets/grid.png` → `front_end/assets/expo.icon/Assets/grid.png`
- `assets/expo.icon/icon.json` → `front_end/assets/expo.icon/icon.json`
- `assets/images/android-icon-background.png` → `front_end/assets/images/android-icon-background.png`
- `assets/images/android-icon-foreground.png` → `front_end/assets/images/android-icon-foreground.png`
- `assets/images/android-icon-monochrome.png` → `front_end/assets/images/android-icon-monochrome.png`
- `assets/images/expo-badge-white.png` → `front_end/assets/images/expo-badge-white.png`
- `assets/images/expo-badge.png` → `front_end/assets/images/expo-badge.png`
- `assets/images/expo-logo.png` → `front_end/assets/images/expo-logo.png`
- `assets/images/favicon.png` → `front_end/assets/images/favicon.png`
- `assets/images/icon.png` → `front_end/assets/images/icon.png`
- `assets/images/logo-glow.png` → `front_end/assets/images/logo-glow.png`
- `assets/images/react-logo.png` → `front_end/assets/images/react-logo.png`
- `assets/images/react-logo@2x.png` → `front_end/assets/images/react-logo@2x.png`
- `assets/images/react-logo@3x.png` → `front_end/assets/images/react-logo@3x.png`
- `assets/images/splash-icon.png` → `front_end/assets/images/splash-icon.png`
- `assets/images/tabIcons/explore.png` → `front_end/assets/images/tabIcons/explore.png`
- `assets/images/tabIcons/explore@2x.png` → `front_end/assets/images/tabIcons/explore@2x.png`
- `assets/images/tabIcons/explore@3x.png` → `front_end/assets/images/tabIcons/explore@3x.png`
- `assets/images/tabIcons/home.png` → `front_end/assets/images/tabIcons/home.png`
- `assets/images/tabIcons/home@2x.png` → `front_end/assets/images/tabIcons/home@2x.png`
- `assets/images/tabIcons/home@3x.png` → `front_end/assets/images/tabIcons/home@3x.png`
- `assets/images/tutorial-web.png` → `front_end/assets/images/tutorial-web.png`
- `app.json` → `front_end/app.json`: Expo configuration follows the app root. Expo installer may register required plugins.
- `tsconfig.json` → `front_end/tsconfig.json`: existing aliases now resolve correctly; include patterns narrowed to frontend source and Expo generated types.
- `scripts/reset-project.js` → `front_end/scripts/reset-project.js`: existing reset command remains scoped to the frontend. It was not executed.

## Added or updated files
- Root `package.json`: replaced incompatible app dependencies with forwarding scripts for start, web, ios, android, lint, typecheck, build.
- `front_end/package.json`: Expo SDK 57 dependencies selected by Expo installer; pnpm version and Node requirement; added build and typecheck scripts.
- `front_end/pnpm-lock.yaml`: generated authoritative frontend lockfile. Root `package-lock.json` removed; root `pnpm-lock.yaml` replaced with a minimal dependency-free launcher lockfile. Neither contains application dependencies.
- `front_end/eslint.config.js`: Expo flat ESLint configuration, excluding build output and optional reset backup.
- `front_end/.gitignore`: ignore frontend dependencies, builds, generated native folders, Expo state, and reset backups.
- Root `.gitignore`: ignore local `.pnpm-store/` package cache.
- Root `README.md`: current directory layout and frontend startup instructions, with backend tooling limitation noted.
- `front_end/README.md`: installation, startup, validation, layout, and dependency management.
- `front_end/SETUP_CHANGES.md`: this change record.

## Generated local files
Installation creates ignored `front_end/node_modules/` and a local pnpm cache. Validation may create ignored `.expo/`, `expo-env.d.ts`, and `dist/` inside `front_end/`.

## Tooling compatibility

- `front_end/package.json` and lockfile: ESLint pinned to major 9 because Expo lint plugins do not support major 10.
- `front_end/pnpm-workspace.yaml`: allow the `unrs-resolver` dependency postinstall script used by the lint resolver.
- `front_end/app.json`: Expo installer registered expo-font, expo-image, expo-status-bar, and expo-web-browser plugins.

- `front_end/src/env.d.ts`: reference Expo types for CSS imports before the first dev-server run.

- `front_end/src/hooks/use-color-scheme.web.ts`: replace effect-driven hydration state with useSyncExternalStore; preserve light server rendering and client theme preference.

- `front_end/src/app/index.tsx`: update the displayed reset command to pnpm.

## Verification

- Expo Doctor: 21/21 checks passed.
- ESLint and TypeScript passed.
- Web export generated Home, Explore, sitemap, and not-found routes.
- Root pnpm web forwarding command started the app on localhost:8081.
- Browser: Home and Explore rendered, tab navigation worked, no browser console errors observed.
- Native simulator/device execution was not tested.

Normal watch-mode verification was blocked by the agent sandbox preventing Watchman startup (macOS service/nice operation). Browser verification used CI=1, which disables file watching. Run pnpm web in a normal terminal for hot reload.
