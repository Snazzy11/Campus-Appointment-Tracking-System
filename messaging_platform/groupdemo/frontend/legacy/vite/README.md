# Archived Vite frontend

This is the previous browser implementation, preserved during migration to Expo. It is not part of the active Metro bundle, TypeScript checks, or ESLint checks. src/App.jsx contains the former public/DM interface; oldsrc/App.jsx is an even older public-chat version. The archived Vite config proxies /api and /auth to port 8000.

The active package.json/package-lock.json now target Expo and no longer install Vite. This folder is a source reference, not a standalone runnable project. See [the active frontend README](../../README.md).
