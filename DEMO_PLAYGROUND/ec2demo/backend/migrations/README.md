# Database migrations

Alembic tracks the PostgreSQL schema. Run commands from `backend/` after `uv sync --locked` and database environment configured.

```sh
uv run --locked alembic history
uv run --locked alembic current
uv run --locked alembic upgrade head
```

`alembic.ini` points to `migrations/` and prepends the current directory for imports. Its `sqlalchemy.url` is a placeholder: `env.py` imports the configured engine from `app.services.database`, so DB environment variables determine the actual connection. Both online/offline contexts use `Base.metadata` and `compare_type=True`.

## Revision chain

| Order | Revision | Change |
| --- | --- | --- |
| 1 | 572d27b80883 | users and messages; unique Cognito-subject index; message-user index |
| 2 | 80ebcb64f752 | conversations and memberships; nullable messages.conversation_id FK/index |
| 3 (head) | 441d5178d7b4 | nullable conversations.direct_key and unique constraint |

The direct-key migration does not populate existing conversations. PostgreSQL permits multiple NULL values under this unique constraint, so preexisting DMs do not participate in the application's canonical-pair lookup until their keys are deliberately backfilled. Review duplicate historical pairs before planning any data migration.

## Schema bootstrap versus migration

`uv run --locked python -m scripts.init_db` calls `Base.metadata.create_all()` against the current model definitions. It creates absent tables but does not perform Alembic upgrades, reconcile existing columns, or record revision history. Prefer Alembic for a fresh empty database. A database previously initialized with create_all can conflict with the first migration's create-table operations; inspect its schema and Alembic state before reconciling. Do not blindly stamp an unverified schema as current.

## Creating a migration

```sh
uv run --locked alembic revision --autogenerate -m "describe schema change"
```

This inspects the configured database. Review generated upgrade/downgrade operations, existing data compatibility, constraint names, and any required backfill before applying. Autogeneration alone does not guarantee a safe or complete migration.

## Rollback caveats

Revisions 80ebcb64f752 and 441d5178d7b4 contain generated `op.drop_constraint(None, ...)` calls and explicit warnings that these downgrade directives will fail as rendered. Resolve actual constraint names or adopt an appropriate naming convention before relying on downgrade. Removing message/conversation tables or columns also discards data. The documentation pass did not execute migrations or rollback operations.

`script.py.mako` is the revision-generation template. The extensionless `migrations/README` is the original generic Alembic note; this file documents the project's actual migration setup. The pre-DM dump in `backend/` was not inspected and is not automatically restored by any script.

## Verified email directory (b63d129fe407)

Adds the non-null email_verified boolean with default false and a partial lower(email) text_pattern_ops index for prefix lookup. Old users remain unverified until their next Cognito sign-in updates the claim; do not mark all old accounts verified as a backfill. Upgrade and downgrade were validated against disposable PostgreSQL 17 with existing messages/conversations. Deploy the migration before using the updated API; the redeployment script requires --migrate when database and image revisions differ.
