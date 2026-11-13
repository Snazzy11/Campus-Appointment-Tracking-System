"""Database fixtures for the calendar event tests.

The tests need Postgres (JSONB and ON CONFLICT). They use a separate database so the
dev data is never touched: `TEST_DATABASE_URL` if set, otherwise the dev DATABASE_URL
with the database name replaced by `cats_test` (created on first use). If Postgres is
not reachable, the database tests are skipped; `make db-up` starts it.
"""

import os
from collections.abc import Iterator

import pytest

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://cats:cats-devonly@127.0.0.1:5432/cats"
)

from cats.database.database import Base
from cats.database.models import EventOccurrence, EventSeries, User
from cats.settings import settings
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

TABLES = [User.__table__, EventSeries.__table__, EventOccurrence.__table__]


def _ensure_database(url_text: str) -> None:
    url = make_url(url_text)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as connection:
            exists = connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": url.database},
            )
            if not exists:
                connection.execute(text(f'CREATE DATABASE "{url.database}"'))
    finally:
        admin.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    explicit = os.environ.get("TEST_DATABASE_URL")
    url_text = explicit or make_url(settings.database_url).set(
        database="cats_test"
    ).render_as_string(hide_password=False)
    try:
        if not explicit:
            _ensure_database(url_text)
        test_engine = create_engine(url_text)
        with test_engine.connect():
            pass
    except OperationalError as error:
        pytest.skip(f"Postgres is not reachable for the event tests: {error}")
    Base.metadata.drop_all(test_engine, tables=TABLES)
    Base.metadata.create_all(test_engine, tables=TABLES)
    yield test_engine
    Base.metadata.drop_all(test_engine, tables=TABLES)
    test_engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    """A session whose work (even session.commit()) is rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(
        bind=connection, join_transaction_mode="create_savepoint", autoflush=False
    )
    yield db
    db.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def owner_id(session: Session) -> int:
    user = User(email="owner@example.com", first_name="Test", last_name="Owner")
    session.add(user)
    session.flush()
    return user.id
