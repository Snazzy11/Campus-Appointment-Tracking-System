from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from database.database import Base


class RSO(Base):
    __tablename__ = "rsos"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255))
    link: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(50))
    location: Mapped[str] = mapped_column(String(100))
