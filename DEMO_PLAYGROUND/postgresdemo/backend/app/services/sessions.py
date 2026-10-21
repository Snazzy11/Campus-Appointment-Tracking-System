"""Development-only session store. One process; sessions vanish on restart."""
import secrets
import time

SESSION_LIFETIME = 8 * 60 * 60
_sessions: dict[str, dict] = {}


def create_session(sub: str, email: str | None) -> str:
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = {
        "sub": sub,
        "email": email,
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
