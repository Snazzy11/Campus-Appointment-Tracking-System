"""Local API entry point for ``uv run fastapi dev`` from the repository root."""

import os
import sys
from pathlib import Path

# Match the backend import path used by the Docker and Makefile launchers.
sys.path.insert(0, str(Path(__file__).resolve().parent / "back_end" / "app"))
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://cats:cats-devonly@127.0.0.1:5432/cats"
)

from api.main import app

__all__ = ["app"]
