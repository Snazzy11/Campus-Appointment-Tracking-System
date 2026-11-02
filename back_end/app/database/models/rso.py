from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_extra_types.phone_numbers import PhoneNumber
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from database.database import Base


class USPhone(PhoneNumber):
    default_region_code = "US"
    supported_regions = ["US"]  # noqa: RUF012 (matches the library's own example)
    phone_format = "NATIONAL"


class RSO(Base):
    __tablename__ = "rsos"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255))
    link: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(50))
    location: Mapped[str] = mapped_column(String(255))


class RSOBase(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=255)
    link: str = Field(max_length=100)
    email: EmailStr | Literal["None"] = "None"
    phone: USPhone | Literal["None"] = "None"
    location: str = Field(max_length=255)

    @field_validator("link")
    @classmethod
    def validate_link(cls, link: str) -> str:
        if not link.startswith(("http://", "https://")):
            raise ValueError("The link must start with http:// or https://")
        return link
