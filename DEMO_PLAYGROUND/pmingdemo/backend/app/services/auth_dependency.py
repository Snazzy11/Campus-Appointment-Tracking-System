
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User
from .db_dependency import get_db
from .sessions import get_request_session


def require_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:

    session = get_request_session(request)

    if session is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    user = db.scalar(
        select(User).where(
            User.cognito_sub == session["sub"]
        )
    )

    if user is None:
        user = User(
            cognito_sub=session["sub"],
            email=session["email"],
        )

        db.add(user)
        db.flush()
        db.commit()
        db.refresh(user)

    elif user.email != session["email"]:
        user.email = session["email"]
        db.commit()

    return user
