from typing import Literal

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    TypeAdapter,
    ValidationError,
    field_validator,
)
from pydantic_extra_types.phone_numbers import PhoneNumber


class USPhone(PhoneNumber):
    default_region_code = "US"
    supproted_regions = "US"
    phone_format = "NATIONAL"


_email_adapter = TypeAdapter(EmailStr)


class RSOBase(BaseModel):
    __tablename__ = "rsos"

    id: int
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=255)
    link: str = Field(max_length=100)
    email: EmailStr | Literal["None"] = "None"
    phone: USPhone | Literal["None"] = "None"
    location: str = Field(max_length=255)

    def set_email(self, new_email: str) -> None:
        self.email = new_email

    @field_validator("email", mode="before")
    @classmethod
    def coerce_invalid_email(cls, email):
        if email == "None":
            return "None"
        try:
            return _email_adapter.validate_python(email)
        except ValidationError:
            return "None"

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
