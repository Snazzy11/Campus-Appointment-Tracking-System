from database.database import Base
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column


class Profile(Base):  
    __tablename__ = "profiles"

    