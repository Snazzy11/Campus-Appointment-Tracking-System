# Phase 1: Local reliability and Git safety

1. From `reactdemo/`, run `./start-dev.sh`.
2. Visit http://localhost:5173 and send a message. Open a second browser tab to verify live delivery.
3. In a second terminal run `./smoke-test.sh`. This checks direct backend health, proxied health, posting, and SSE replay. It posts a test message to the in-memory chat history.
4. Visit http://127.0.0.1:8000/docs for FastAPI's interactive API documentation.

## Endpoints

- `GET /api/health`: returns `{"status":"ok","service":"campus-messaging"}`
- `POST /api/data`: sends JSON `{"text":"..."}`
- `GET /api/stream`: Server-Sent Events feed, including recent history
- `GET /api/messages`: recent message history

## Git

From `reactdemo/` (only if it is not already inside an existing Git repository):

```bash
git init
git add .
git status
git commit -m "Establish local development baseline"
```

If `reactdemo` is already inside the parent project repository, **do not run `git init`**. Run `git status` from the existing repository root instead.

The `.gitignore` prevents newly untracked `.env` files, keys, venvs, node_modules, and build outputs from being staged. It does **not** remove secrets already tracked in Git; use `git ls-files` to audit tracked paths.

## Important limitations

This is a development-only messaging prototype: no authentication, no durable storage, no access controls. SSE clients receive messages from shared in-memory history, which resets on restart and is not shared between multiple backend workers. Do not expose it publicly until authentication and authorization are added.
