from typing import Literal

from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
from pydantic_extra_types.phone_numbers import PhoneNumber


class USPhone(PhoneNumber):
    default_region_code = "US"
    supproted_regions = "US"
    phone_format = "NATIONAL"


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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str) -> str:
        try:
            return phone
        except ValidationError:
            raise ValueError("Phone isn't a phone string")
