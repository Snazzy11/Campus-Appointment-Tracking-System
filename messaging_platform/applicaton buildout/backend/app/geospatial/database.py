import os
from functools import lru_cache
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


@lru_cache(maxsize=1)
def spatial_engine():
    url = os.getenv("GEO_DATABASE_URL")
    if os.getenv("GEO_DATA_ENABLED") != "true" or not url:
        raise HTTPException(503, "Campus geographic data is not enabled")
    return create_engine(url, pool_size=2, max_overflow=1, pool_pre_ping=True, pool_timeout=5,
                         connect_args={"connect_timeout": 5},
                         execution_options={"isolation_level": "REPEATABLE READ"})


def get_geo_db():
    try:
        with spatial_engine().begin() as connection:
            connection.execute(text("SET TRANSACTION READ ONLY"))
            connection.execute(text("SET LOCAL statement_timeout='3000ms'"))
            yield connection
    except SQLAlchemyError:
        # Never include SQL parameters (which can contain location) in HTTP errors/logs.
        raise HTTPException(503, "Campus map data is temporarily unavailable. Please try again.") from None


@lru_cache(maxsize=1)
def blip_engine():
    url = os.getenv("GEO_REPORT_DATABASE_URL")
    if os.getenv("GEO_REPORTS_ENABLED") != "true" or not url:
        raise HTTPException(503, "Campus reports are not enabled")
    return create_engine(url, pool_size=2, max_overflow=1, pool_pre_ping=True,
                         pool_timeout=5, connect_args={"connect_timeout": 5})


def get_blip_db():
    try:
        with blip_engine().begin() as connection:
            connection.execute(text("SET LOCAL statement_timeout='3000ms'"))
            connection.execute(text("SET LOCAL lock_timeout='1500ms'"))
            yield connection
    except SQLAlchemyError:
        raise HTTPException(503, "Campus reports are temporarily unavailable. Try again.") from None
