from api.dependencies import db_session
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from sqlalchemy import text

router = APIRouter(tags=["Health"])
