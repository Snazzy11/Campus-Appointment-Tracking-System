# Refactor notes

- Authentication endpoints: `backend/app/routers/auth.py`
- Messaging endpoints and SSE: `backend/app/routers/messages.py`
- In-memory authentication sessions: `backend/app/services/sessions.py`
- In-memory message history: `backend/app/services/messaging.py`
- `backend/app/main.py` registers both routers.
- Authenticated messages use the Cognito email; anonymous messages use the client IP.
- The original `.env`, `.venv`, and `node_modules` are intentionally **not included** in this archive. Copy your existing `backend/.env` into the extracted project before starting. Never commit it.
- Run `./scripts/start-dev.sh` from the project root.
- This remains a local prototype: sessions and messages disappear on backend restart, anonymous messaging is allowed, and full CSRF/production hardening is not yet implemented.
