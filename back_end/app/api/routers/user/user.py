from typing import Annotated

from api.dependencies import db_session
from api.routers.auth.auth import require_user
from database.models.user.user import User
from fastapi import APIRouter, Depends
from sqlalchemy.dialects.postgresql import insert

router = APIRouter()


# create an API route to add a user to the database
@router.post("/user/store-user")
def ensure_user(db: db_session, identity: Annotated[dict, Depends(require_user)]):
    statement = (
        insert(User)
        .values(
            # auth/cognito defines these fields after login and verification
            cognito_subject=identity["sub"],
            email=identity["email"],
        )
        .on_conflict_do_update(
            index_elements=[User.cognito_subject],
            set_={"email": identity["email"]},
        )
        .returning(
            User.id, User.email
        )  # user id is added automatically by the database incrementally
    )

    user = db.execute(statement).mappings().one()
    result = dict(user)
    db.commit()

    return result
