
import base64
import hashlib
import os
import secrets
from urllib.parse import urlencode

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from ..models import User
from ..services.profiles import account_profile
from ..services.auth_dependency import require_user
from fastapi.responses import RedirectResponse
from jwt import PyJWKClient

from ..services.sessions import (
    create_session, delete_session, SESSION_LIFETIME,
    get_request_session, request_session_id,
)

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
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
APP_REDIRECT_URIS = {uri.strip() for uri in os.getenv(
    "COGNITO_APP_REDIRECT_URIS",
    "campusmessaging://auth/callback,http://localhost:8081/auth/callback,http://127.0.0.1:8081/auth/callback",
).split(",") if uri.strip()}
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8081").rstrip("/")


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



async def exchange_code(code: str, verifier: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        token_response = await client.post(
            f"{DOMAIN}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "code": code,
                "redirect_uri": redirect_uri,
                "code_verifier": verifier,
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
        signing_key = await run_in_threadpool(
            jwks_client.get_signing_key_from_jwt, id_token
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

    if not claims.get("email"):
        raise HTTPException(status_code=400, detail="An email claim is required")
    return claims


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

    claims = await exchange_code(code, oauth_verifier, REDIRECT_URI)

    session_id = create_session(claims["sub"], claims.get("email"), claims.get("email_verified") is True)

    response = RedirectResponse(FRONTEND_URL, status_code=303)

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
def me(response: Response, user: User = Depends(require_user)):
    response.headers["Cache-Control"] = "no-store"
    return account_profile(user)


@router.post("/auth/logout")
def logout(
    request: Request,
    campus_session: str | None = Cookie(default=None),
):
    # Basic same-origin check for the local prototype.
    origin = request.headers.get("origin")
    expected_origin = FRONTEND_URL

    if origin != expected_origin:
        raise HTTPException(
            status_code=403,
            detail="Invalid request origin",
        )

    delete_session(campus_session)

    response = RedirectResponse(FRONTEND_URL, status_code=303)
    response.delete_cookie("campus_session", path="/")
    return response


class AppLogin(BaseModel):
    code: str = Field(min_length=1, max_length=4096)
    code_verifier: str = Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9._~-]+$")
    redirect_uri: str = Field(min_length=1, max_length=2048)


@router.get("/api/auth/config")
def app_auth_config():
    # Public OAuth metadata only. No database or Cognito credentials are exposed.
    return {"domain": DOMAIN, "client_id": CLIENT_ID}


@router.post("/api/auth/session")
async def app_login(payload: AppLogin):
    if payload.redirect_uri not in APP_REDIRECT_URIS:
        raise HTTPException(status_code=400, detail="Redirect URI is not allowed")
    try:
        claims = await exchange_code(payload.code, payload.code_verifier, payload.redirect_uri)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Cognito could not be reached") from None
    session_id = create_session(claims["sub"], claims["email"], claims.get("email_verified") is True)
    return {"session_token": session_id, "expires_in": SESSION_LIFETIME}


@router.post("/api/auth/logout", status_code=204)
def app_logout(request: Request):
    # This endpoint requires a bearer header; cookie-only requests cannot revoke sessions.
    if not request.headers.get("authorization", "").lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer authentication required")
    if get_request_session(request) is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    delete_session(request_session_id(request))
    return Response(status_code=204)
