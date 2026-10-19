from database.database import Base
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    verified: Mapped[bool] = mapped_column(Boolean) # i think this works 

