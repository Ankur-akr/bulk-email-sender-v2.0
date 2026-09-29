"""
Auth routes.

get_current_user()  — FastAPI dependency used by every other route.
                      Decodes JWT and returns a user dict with `sub` as the
                      stable user_id. This is the ONLY place auth logic lives.

POST /api/auth/google  — accepts Google access token, fetches userinfo from
                         Google, upserts User row, returns app JWT.
POST /api/auth/login   — admin username/password fallback.
GET  /api/auth/me      — returns current user from JWT (no DB hit).
GET  /api/auth/google-client-id — lets frontend read client ID from env.
"""
import os
import hmac
import httpx
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from auth_utils import create_jwt, decode_jwt
import database

router   = APIRouter()
security = HTTPBearer(auto_error=False)

ADMIN_USER        = os.getenv("ADMIN_USERNAME",  "admin")
ADMIN_PASS        = os.getenv("ADMIN_PASSWORD",  "")   # empty = admin login disabled
GOOGLE_CLIENT_ID  = os.getenv("GOOGLE_CLIENT_ID", "")
ALLOWED_DOMAINS   = [
    d.strip()
    for d in os.getenv("ALLOWED_DOMAINS", "").split(",")
    if d.strip()
]


# ── Core dependency ───────────────────────────────────────────────────────────

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Decode the Bearer JWT and return the user payload.
    Raises 401 if the token is missing, invalid, or expired.
    The returned dict always has a `sub` key that is the stable user_id.
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if "sub" not in payload:
        raise HTTPException(status_code=401, detail="Malformed token — missing sub")
    return payload


# ── Request models ────────────────────────────────────────────────────────────

class GoogleLoginRequest(BaseModel):
    credential: str   # Google access token from useGoogleLogin(flow="implicit")

class AdminLoginRequest(BaseModel):
    username: str
    password: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/google")
async def google_login(req: GoogleLoginRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured on the server")

    # Exchange access token for user profile
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.credential}"},
            timeout=10,
        )

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google rejected the token")

    info  = r.json()
    email = info.get("email", "")
    sub   = info.get("sub", "")   # stable Google user ID — never changes

    if not email or not sub:
        raise HTTPException(status_code=401, detail="Could not retrieve email from Google")

    # Optional domain restriction
    if ALLOWED_DOMAINS and email.split("@")[-1] not in ALLOWED_DOMAINS:
        raise HTTPException(status_code=403, detail="Email domain not allowed")

    name    = info.get("name",    email.split("@")[0])
    picture = info.get("picture", "")

    # Upsert user row in DB
    await database.ensure_user(user_id=sub, email=email, name=name, picture=picture)

    # Build JWT — sub is the tenant key
    user_payload = {
        "sub":         sub,
        "email":       email,
        "name":        name,
        "picture":     picture,
        "auth_method": "google",
    }
    return {"access_token": create_jwt(user_payload), "token_type": "bearer", "user": user_payload}


@router.post("/login")
async def admin_login(req: AdminLoginRequest):
    """Fallback admin login — uses email as the stable user_id."""
    if not ADMIN_PASS:
        raise HTTPException(status_code=503, detail="Admin login is disabled on this server")
    if not (hmac.compare_digest(req.username, ADMIN_USER) and hmac.compare_digest(req.password, ADMIN_PASS)):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = f"admin:{req.username}"
    email   = f"{req.username}@admin.local"
    await database.ensure_user(user_id=user_id, email=email, name=req.username)

    user_payload = {
        "sub":         user_id,
        "email":       email,
        "name":        req.username,
        "picture":     "",
        "auth_method": "password",
    }
    return {"access_token": create_jwt(user_payload), "token_type": "bearer", "user": user_payload}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@router.get("/google-client-id")
async def get_google_client_id():
    return {"client_id": GOOGLE_CLIENT_ID}
