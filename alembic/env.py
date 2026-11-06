from logging.config import fileConfig

from cats.database import models  # noqa: F401  # registers every model on Base.metadata
from cats.database.database import Base
from cats.settings import settings
from geoalchemy2 import alembic_helpers
from sqlalchemy import engine_from_config, pool, text

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use the same DATABASE_URL as the app (environment variable or .env), so there is
# only one place to configure it. `%` is escaped because the ini parser interpolates it.
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

# Autogenerate compares the database against this metadata
target_metadata = Base.metadata

# Tables created by Postgres extensions (PostGIS's spatial_ref_sys, plus the tiger and
# topology tables, which are on the search_path in the postgis image). Filled in by
# run_migrations_online. Without this, autogenerate would try to drop all of them.
extension_tables: set[str] = set()

EXTENSION_TABLES_SQL = text(
    """
    SELECT c.relname
    FROM pg_depend d
    JOIN pg_class c ON c.oid = d.objid
    WHERE d.classid = 'pg_class'::regclass
      AND d.deptype = 'e'
      AND c.relkind IN ('r', 'p', 'v', 'm')
    """
)


def include_object(obj, name, type_, reflected, compare_to):
    if (
        type_ == "table"
        and reflected
        and compare_to is None
        and name in extension_tables
    ):
        return False
    # geoalchemy2 creates spatial indexes itself; this keeps autogenerate from duplicating them
    return alembic_helpers.include_object(obj, name, type_, reflected, compare_to)


# Shared by online and offline mode. The geoalchemy2 helpers make autogenerate emit
# correct create/drop operations for Geometry columns and their spatial indexes.
CONFIGURE_OPTS = {
    "target_metadata": target_metadata,
    "include_object": include_object,
    "process_revision_directives": alembic_helpers.writer,
    "render_item": alembic_helpers.render_item,
    "compare_type": True,
}


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **CONFIGURE_OPTS,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        extension_tables.update(connection.scalars(EXTENSION_TABLES_SQL))
        # End the transaction that query opened; otherwise Alembic treats it as an outer
        # transaction it doesn't own and never commits the migration.
        connection.commit()
        context.configure(connection=connection, **CONFIGURE_OPTS)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
