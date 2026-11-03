
API Docs are at http://127.0.0.1:8000/api/docs
## Local development

`make dev` starts the development database and applies the additive users-table
migration before starting Expo and FastAPI. For an already-running development
database, run `make db-migrate` to apply it without restarting or deleting data.
`make stack-test` applies the same migration to its separate test database.
Changing a SQLAlchemy model does not update an existing database schema: future
schema changes need migrations too. Production migrations are administrator-run;
apply `deploy/migrations/003_users.sql` as `postgres` before deploying the user
endpoint. The application receives row and sequence access, not table ownership.

From the repository root, start the database once with `make db-up`, then run:

```sh
uv run fastapi dev
```

The root `dev.py` launcher configures the backend import path and defaults to the
local Docker database on `127.0.0.1:5432`. An existing `DATABASE_URL` environment
variable takes precedence. This works on macOS, Windows, and Linux without
shell-specific environment assignments. Docker continues to use `api.main:app`.

Open http://127.0.0.1:8000/api/docs for the API documentation. If the Docker API is
already using port 8000, stop only that service with `docker compose stop app`
before starting the local server. Keep the database running.
