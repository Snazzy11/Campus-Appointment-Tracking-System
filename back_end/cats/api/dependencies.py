from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from cats.database.database import get_db

db_session = Annotated[Session, Depends(get_db)]
