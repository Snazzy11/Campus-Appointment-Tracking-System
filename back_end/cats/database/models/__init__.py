# Import every model here so they all register on Base.metadata.
# Alembic's env.py imports this package, so a model missing from this list
# is invisible to `alembic revision --autogenerate`.
from cats.database.models.location import Location
from cats.database.models.rso import RSO
from cats.database.models.user.user import User

__all__ = ["RSO", "Location", "User"]
