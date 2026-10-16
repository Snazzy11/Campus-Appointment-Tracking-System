# ADR 0001 — Add geospatial features to the existing Expo/FastAPI app

Status: accepted for initial integration; spatial production rollout pending validated operational plan.

Use platform-specific MapLibre renderers and shared typed GeoJSON contracts. Reuse the Maps tab, authentication identities and existing application navigation. Do not replace the backend or messaging schema. Native MapLibre requires a new binary; Expo Go cannot validate it. Map provider keys are public and restricted; no OSM public-tile production fallback.

Use an isolated PostgreSQL 17 spatial test environment before changing populated databases. Keep production database image unchanged during Stage 0/1. Current local image lacks extensions; official PostGIS image documentation currently advertises amd64, while local/cloud architectures are ARM64. This is an operational compatibility requirement, not solved by CREATE EXTENSION.

Alternatives: a GL JS WebView would share web rendering but adds bridge, accessibility and GPU limitations; it is not selected as native parity. A separate mapping application would break integration and is rejected. Multiple routing engines add operations cost and are deferred. Three.js and Gaussian-splat libraries are not installed until corresponding stages have data and budgets.
