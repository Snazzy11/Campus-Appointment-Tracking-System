
from collections.abc import Generator

from sqlalchemy.orm import Session

from .database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as db:
        yield db
