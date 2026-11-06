from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from cats.settings import settings

engine = create_engine(
    settings.database_url, pool_pre_ping=True, future=True
)  # Add `echo=True` for verbose logging

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
