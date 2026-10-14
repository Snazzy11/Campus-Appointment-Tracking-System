# Map provider setup

## Selected provider: OpenFreeMap

OpenFreeMap is selected for street maps; satellite/hybrid and offline maps are deferred by the user. Web and native use the same documented style, with no account or API key:

```dotenv
EXPO_PUBLIC_MAPS_ENABLED=true
EXPO_PUBLIC_MAP_STREET_STYLE=https://tiles.openfreemap.org/styles/liberty
EXPO_PUBLIC_MAP_NATIVE_STREET_STYLE=https://tiles.openfreemap.org/styles/liberty
```

These values are configured in the private local frontend/.env and the example configuration. Existing API settings are preserved. The app requests only viewed tiles; no background downloads/offline cache are implemented. Keep OpenMapTiles and OpenStreetMap attribution visible. Native MapLibre still requires a rebuilt development app. Production remains opt-in via build configuration; no mapping deployment occurred in this follow-up.

Official instructions: https://openfreemap.org/quick_start/ (same styles supported on MapLibre Native); service/license and attribution: https://openfreemap.org/ . It is a hosted public service with no SLA. Empty satellite/hybrid styles remain unavailable rather than substituting street tiles. Changing providers does not supply university-verified entrances or walking routes.

## MapTiler account and licensing

Create an account yourself at https://cloud.maptiler.com/ and choose a plan/licensing appropriate for expected traffic and satellite use. Review attribution, limits and caching policy. No account, plan purchase or Terms acceptance is automated here.

Create a public browser key restricted to exact allowed application origins/domains in the MapTiler dashboard. Include the production host messaging.tufts.pro and only the local origins you actually use (localhost:8081, 127.0.0.1:8081, localhost:18083, or a specific preview port). Verify restriction syntax with https://docs.maptiler.com/cloud/api/authentication-key/. Use a separate provider-supported policy/key for native apps: browser-origin-only restrictions may block native requests. Do not broadly unrestrict your browser key to make native requests succeed. Add usage quotas/monitoring. These keys are public; never put private cloud/admin credentials in EXPO_PUBLIC values.

## Local configuration

Copy the settings from frontend/.env.maps.example into frontend/.env (preserve EXPO_PUBLIC_API_URL). Set EXPO_PUBLIC_MAPS_ENABLED=true and EXPO_PUBLIC_MAPTILER_KEY to the restricted public browser key. For rebuilt native targets set EXPO_PUBLIC_MAPTILER_NATIVE_KEY independently. Restart Metro with cache clearing after build-time environment changes.

Street, satellite and hybrid use https://api.maptiler.com/maps/{streets-v2,satellite,hybrid}/style.json?key=... . Validate each against the account's actual entitlements. Keep attribution visible. For another licensed provider set the EXPO_PUBLIC_MAP_{STREET,SATELLITE,HYBRID}_STYLE HTTPS URLs; native overrides use EXPO_PUBLIC_MAP_NATIVE_{STREET,SATELLITE,HYBRID}_STYLE. Missing modes are disabled rather than substituted with misleading imagery.

For native, the official @maplibre/maplibre-react-native plugin is in app.json. Rebuild using npx expo run:ios (or the EAS development profile), or Android equivalent. SDK57/RN0.86 meets the package's advertised >=Expo54/RN0.80/new-architecture requirements; compilation/device verification is still required. No new permission for GPS is requested by the foundation.

## Containers/cloud

Compose web build arguments read the public variables from the chosen --env-file. Export the same variables before scripts/deploy-ec2.sh to pass them to the existing local-image builder, e.g. EXPO_PUBLIC_MAPS_ENABLED=true and the public key. Dockerfile defaults off if absent. Public map configuration is bundled at build time; changing an API runtime environment will not update a static web bundle. Rebuild web after provider changes. Do not deploy until Stage 1 tests and provider/key restrictions are verified.

No OSM public-tile production fallback or bulk caching is configured. The MapLibre demo style may be used for developer renderer smoke checks only; it does not prove campus coverage or satellite support. See https://maplibre.org/maplibre-react-native/docs/setup/getting-started/ and https://operations.osmfoundation.org/policies/tiles/.

## Acceptance checklist

Verify actual campus coverage, attribution, all three mode loads, camera retention across style changes, rejected-key and quota/network failures, keyboard and touch controls, tab/modal coexistence, map cleanup, native rebuild and physical/simulator behavior. Complete the final viewport matrix last. Keep offline, accessibility and 3D promises out of this release until those stages are implemented.


## Worker asset delivery

npm install/ci and npm script launch/build hooks run scripts/prepare-map-assets.mjs. Direct npx expo export/start invocations must run that script first if assets have not been generated. The versioned public/maplibre directory is generated/ignored; it contains the package's module worker and license. Expo static export copies it. Keep /maplibre/<version>/maplibre-gl-worker.mjs reachable with JavaScript MIME (not an HTML SPA fallback). The container Nginx config supplies this; custom servers must do likewise. Worker version must match the installed renderer. GPU/worker failure is an error state, not a ready map.
