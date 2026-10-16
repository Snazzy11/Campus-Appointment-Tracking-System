"""Development-only session store. One process; sessions vanish on restart."""
import secrets
import time

SESSION_LIFETIME = 8 * 60 * 60
_sessions: dict[str, dict] = {}


def create_session(sub: str, email: str | None, email_verified: bool = False) -> str:
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = {
        "sub": sub,
        "email": email,
        "email_verified": email_verified is True,
        "expires": time.time() + SESSION_LIFETIME,
    }
    return session_id


def get_session(session_id: str | None) -> dict | None:
    if not session_id:
        return None
    session = _sessions.get(session_id)
    if not session:
        return None
    if session["expires"] <= time.time():
        _sessions.pop(session_id, None)
        return None
    return session


def delete_session(session_id: str | None) -> None:
    if session_id:
        _sessions.pop(session_id, None)


def request_session_id(request) -> str | None:
    """Bearer credentials take precedence; never downgrade invalid headers to cookies."""
    authorization = request.headers.get("authorization")
    if authorization is not None:
        scheme, _, token = authorization.partition(" ")
        return token if scheme.lower() == "bearer" and token else None
    return request.cookies.get("campus_session")


def get_request_session(request) -> dict | None:
    return get_session(request_session_id(request))
