
API Docs are at http://127.0.0.1:8000/docs
## Local development

From the repository root, start the database once with `make db-up`, then run:

```sh
make api-up
```

The backend is the `cats` package in `back_end/cats/`, installed by `uv sync`.
It reads `DATABASE_URL` from the environment or from a `.env` file in the directory
you run it from; `make setup` (or `make api-up`) creates `.env` from `.env.example`.

Open http://127.0.0.1:8000/docs for the API documentation. If the Docker API is
already using port 8000, stop only that service with `docker compose stop app`
before starting the local server. Keep the database running.
