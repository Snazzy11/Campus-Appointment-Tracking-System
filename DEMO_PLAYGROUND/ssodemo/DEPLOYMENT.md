# React + FastAPI deployment

## Development

Terminal 1 (from `backend`): `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`

Terminal 2 (from `frontend`): `npm ci && npm run dev`

Vite proxies `/api/*` to FastAPI. The React app uses relative API URLs.

## Production on a Linux server with Nginx

1. Install Nginx, Python and Node.js on the server (or build frontend elsewhere).
2. In `frontend`, run `npm ci && npm run build`.
3. Deploy the contents of `frontend/dist` to `/var/www/campus-app/dist` (with appropriate read permissions).
4. Install Python dependencies from `backend/requirements.txt`, and run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from `backend` under a supervised service (e.g. systemd).
5. Copy `deploy/nginx.conf.example` into your Nginx sites configuration, replace `example.com` with your domain, and run `sudo nginx -t` before reloading Nginx.
6. Set up HTTPS with a trusted certificate before exposing the site publicly. Configure firewall rules and restrict port 8000 to loopback.

The Nginx `/api/` proxy retains the `/api/` prefix because `proxy_pass` has no trailing URI slash. `proxy_buffering off` is important for SSE.

Messages currently live in memory; use durable storage and a shared event broker before deploying multiple backend workers. Add authentication and authorization before public deployment.
