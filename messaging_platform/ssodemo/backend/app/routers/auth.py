
import base64
import hashlib
import os
import secrets
from urllib.parse import urlencode

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Cookie, HTTPException, Request
from fastapi.responses import RedirectResponse
from jwt import PyJWKClient

from ..services.sessions import create_session, get_session, delete_session, SESSION_LIFETIME

load_dotenv()

router = APIRouter(tags=["authentication"])

DOMAIN = os.environ["COGNITO_DOMAIN"].rstrip("/")
CLIENT_ID = os.environ["COGNITO_CLIENT_ID"]
REDIRECT_URI = os.environ["COGNITO_REDIRECT_URI"]
REGION = os.environ["COGNITO_REGION"]
USER_POOL_ID = os.environ["COGNITO_USER_POOL_ID"]

ISSUER = (
    f"https://cognito-idp.{REGION}.amazonaws.com/"
    f"{USER_POOL_ID}"
)

jwks_client = PyJWKClient(
    f"{ISSUER}/.well-known/jwks.json"
)

# Local HTTP development. Set True under HTTPS.
COOKIE_SECURE = False


def base64url(data: bytes) -> str:
    return (
        base64.urlsafe_b64encode(data)
        .rstrip(b"=")
        .decode("ascii")
    )


def clear_oauth_cookies(response):
    for name in ("oauth_state", "oauth_verifier"):
        response.delete_cookie(
            name,
            path="/auth",
            secure=COOKIE_SECURE,
            httponly=True,
            samesite="lax",
        )


@router.get("/auth/login")
def login():
    verifier = base64url(secrets.token_bytes(32))
    challenge = base64url(
        hashlib.sha256(verifier.encode("ascii")).digest()
    )
    state = secrets.token_urlsafe(32)

    params = urlencode({
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": "openid email profile",
        "state": state,
        "code_challenge_method": "S256",
        "code_challenge": challenge,
    })

    response = RedirectResponse(
        f"{DOMAIN}/oauth2/authorize?{params}"
    )

    for name, value in (
        ("oauth_state", state),
        ("oauth_verifier", verifier),
    ):
        response.set_cookie(
            key=name,
            value=value,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite="lax",
            max_age=600,
            path="/auth",
        )

    return response


@router.get("/auth/callback")
async def callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    oauth_state: str | None = Cookie(default=None),
    oauth_verifier: str | None = Cookie(default=None),
):
    if error:
        raise HTTPException(
            status_code=400,
            detail="Cognito authentication failed",
        )

    if (
        not code
        or not state
        or not oauth_state
        or not oauth_verifier
        or not secrets.compare_digest(state, oauth_state)
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OAuth login state",
        )

    async with httpx.AsyncClient(timeout=10) as client:
        token_response = await client.post(
            f"{DOMAIN}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "code_verifier": oauth_verifier,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail="Could not complete Cognito login",
        )

    tokens = token_response.json()
    id_token = tokens.get("id_token")

    if not id_token:
        raise HTTPException(
            status_code=400,
            detail="Missing ID token",
        )

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(
            id_token
        )

        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=ISSUER,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )

        if claims.get("token_use") != "id":
            raise jwt.InvalidTokenError(
                "Expected a Cognito ID token"
            )

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Cognito token verification failed",
        )

    session_id = create_session(claims["sub"], claims.get("email"))

    response = RedirectResponse("/", status_code=303)

    response.set_cookie(
        key="campus_session",
        value=session_id,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_LIFETIME,
        path="/",
    )

    clear_oauth_cookies(response)
    return response


@router.get("/api/me")
def me(
    campus_session: str | None = Cookie(default=None),
):
    session = get_session(campus_session)

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )


    return {
        "authenticated": True,
        "sub": session["sub"],
        "email": session["email"],
    }


@router.post("/auth/logout")
def logout(
    request: Request,
    campus_session: str | None = Cookie(default=None),
):
    # Basic same-origin check for the local prototype.
    origin = request.headers.get("origin")
    expected_origin = "http://localhost:5173"

    if origin != expected_origin:
        raise HTTPException(
            status_code=403,
            detail="Invalid request origin",
        )

    delete_session(campus_session)

    response = RedirectResponse("/", status_code=303)
    response.delete_cookie("campus_session", path="/")
    return response
