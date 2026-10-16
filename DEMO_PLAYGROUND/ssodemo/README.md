# Campus Messaging — React + FastAPI

This refactor replaces the separate `server_sse.py` process with a single FastAPI entry point. The original React/Vite configuration is retained.

## Backend (terminal 1)

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
 OR ./start-backend.sh

## Frontend (terminal 2)

```sh
cd frontend
npm ci
npm run dev
```
 OR ./start-frontend.sh
## BOTH
./start-dev.sh

Open http://localhost:5173. API docs: http://localhost:8000/docs.

Endpoints: `GET /api/health`, `GET /api/hello`, `GET /api/messages`, `GET /api/stream` (SSE), `POST /api/data` (`{"text":"Hello"}`).

Notes: Messages are stored in memory and reset on restart. Run a single backend worker for this development implementation. There is no authentication or persistent database; add both before production. If an inherited `expo/tsconfig.base` error occurs, inspect parent `tsconfig.json`/`jsconfig.json` files outside this project.
