
API Docs are at http://127.0.0.1:8000/docs
## Local development

From the repository root, start the database once with `make db-up`, then run:

```sh
uv run fastapi dev
```

The root `dev.py` launcher configures the backend import path and defaults to the
local Docker database on `127.0.0.1:5432`. An existing `DATABASE_URL` environment
variable takes precedence. This works on macOS, Windows, and Linux without
shell-specific environment assignments. Docker continues to use `api.main:app`.

Open http://127.0.0.1:8000/docs for the API documentation. If the Docker API is
already using port 8000, stop only that service with `docker compose stop app`
before starting the local server. Keep the database running.
