
API Docs are at http://127.0.0.1:8000/docs
## Local development

From the repository root, start the database and create its tables once with `make db-migrate`, then run:

```sh
make api-up
```

The backend is the `cats` package in `back_end/cats/`, installed by `uv sync`.
It reads `DATABASE_URL` from the environment or from a `.env` file in the directory
you run it from; `make setup` (or `make api-up`) creates `.env` from `.env.example`.

Open http://127.0.0.1:8000/docs for the API documentation. If the Docker API is
already using port 8000, stop only that service with `docker compose stop app`
before starting the local server. Keep the database running.

## Database migrations (Alembic)

The database schema is managed by [Alembic](https://alembic.sqlalchemy.org/). Migration
files live in `alembic/versions/`. Alembic reads `DATABASE_URL` the same way the app does,
so it targets the database in your `.env`. Run all commands from the repository root.

```sh
make db-migrate                         # apply every migration (also run by make backend-up)
make db-revision m="add chats table"    # generate a migration after changing a model
make db-downgrade                       # undo the most recent migration
uv run alembic current                  # show which migration the database is on
uv run alembic history                  # list all migrations
```

Do not create tables with `Base.metadata.create_all()` or `Table.create()`; add a migration
instead.

### Changing the schema

1. Edit or add a model in `back_end/cats/database/models/`. **A new model file must also be
   imported in `models/__init__.py`**, or Alembic won't see it.
2. Run `make db-revision m="short description"`. It brings your database up to date, compares
   it to the models, and writes a new file in `alembic/versions/`.
3. Read the generated file before committing. Autogenerate can't detect everything. For
   example, a renamed column comes out as a drop plus an add, which loses that column's data.
   Edit the file to fix cases like that.
4. Run `make db-migrate`, then commit the migration together with the model change.

If two branches each add a migration, Alembic reports "multiple heads" after they are merged.
Fix it with `uv run alembic merge heads -m "merge"`.

### Databases created before Alembic

Before migrations existed, `make import-osm` created the `locations` table itself. The first
migration detects that table and keeps it, along with its data, so `make db-migrate` works on
those databases with no extra steps.
