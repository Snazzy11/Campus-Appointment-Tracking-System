from typing import Annotated

from database.database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session

db_session = Annotated[Session, Depends(get_db)]
