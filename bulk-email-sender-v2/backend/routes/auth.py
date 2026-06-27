"""
Authentication routes — supports both Google OAuth and admin username/password.
Uses stateless JWT (Bearer token) so it works on Render without sticky sessions.
"""
import os
from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from auth_utils import create_jwt, decode_jwt, verify_google_token

router = APIRouter()
security = HTTPBearer(auto_error=False)

ADMIN_USER = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "admin123")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


# ── Request / Response models ──────────────────────────────────────────────────

class GoogleLoginRequest(BaseModel):
    credential: str          # Google ID token from frontend


class AdminLoginRequest(BaseModel):
    username: str
    password: str


# ── Dependency: get current user from JWT Bearer token ────────────────────────

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/google")
async def google_login(req: GoogleLoginRequest):
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.credential}"}
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    info = r.json()
    user_info = {
        "email": info.get("email"),
        "name": info.get("name", info.get("email", "").split("@")[0]),
        "picture": info.get("picture", ""),
        "auth_method": "google"
    }
    token = create_jwt(user_info)
    return {"access_token": token, "token_type": "bearer", "user": user_info}


@router.post("/login")
async def admin_login(req: AdminLoginRequest):
    """Fallback username/password login for admin."""
    if req.username != ADMIN_USER or req.password != ADMIN_PASS:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_info = {
        "email": f"{req.username}@admin.local",
        "name": req.username,
        "picture": "",
        "auth_method": "password"
    }
    token = create_jwt(user_info)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_info
    }


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@router.get("/google-client-id")
async def get_google_client_id():
    """Frontend needs the client ID to initialize Google Sign-In."""
    return {"client_id": GOOGLE_CLIENT_ID}
