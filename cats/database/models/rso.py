# from sqlalchemy import String
# from sqlalchemy.orm import Mapped, mapped_column

# from database.database import Base

from pydantic import BaseModel, EmailStr, Field, field_validator, ValidationError
from pydantic_extra_types.phone_numbers import PhoneNumber
from typing import Literal

# class RSO(Base):
#     __tablename__ = "rsos"

#     id: Mapped[int] = mapped_column(primary_key=True)
#     name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
#     description: Mapped[str] = mapped_column(String(255))
#     link: Mapped[str] = mapped_column(String(50))
#     email: Mapped[str] = mapped_column(String(50))
#     phone: Mapped[str] = mapped_column(String(50))
#     location: Mapped[str] = mapped_column(String(100))
    

# pydantic type checking stuffs
class RSOBase(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=255)
    link: str = Field(max_length=100)
    email: EmailStr | Literal["None"] = "None"
    phone: USPhone
    location: str = Field(max_length=255)
    
    @field_validator("email")
    @classmethod
    def validate_email(cls, email: str) -> str: 
        if email == "None":
            return email
        
        try:
            return email
        except ValidationError:
            raise ValueError("Email isn't an email string")
    
    @field_validator("link")
    @classmethod
    def validate_link(cls, link: str) -> str:
        if not link.startswith(("http://", "https://")):
            raise ValueError("The link must start with http:// or https://")
        return link
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str) -> str:
        try:
            return phone
        except ValidationError:
            raise ValueError("Phone isn't a phone string")
    

class USPhone(PhoneNumber):
    default_region_code = 'US'
    supproted_regions = ['US']
    phone_format = "NATIONAL"
    
