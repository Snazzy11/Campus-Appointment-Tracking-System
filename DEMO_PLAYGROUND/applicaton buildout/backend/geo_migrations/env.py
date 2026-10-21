"""Explicit geographic migrations, independent of messaging startup/version table."""
import os
from alembic import context
from sqlalchemy import create_engine

url = os.environ.get("GEO_DATABASE_URL")
if not url:
    raise RuntimeError("Set GEO_DATABASE_URL explicitly; geographic migrations never infer the messaging database")
if context.is_offline_mode():
    raise RuntimeError("Spatial migration requires online extension and rollback safety checks")
with create_engine(url).connect() as connection:
    context.configure(connection=connection, version_table="geo_alembic_version")
    with context.begin_transaction():
        context.run_migrations()
