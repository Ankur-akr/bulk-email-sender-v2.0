"""
JWT utilities + Google OAuth token verification.
Stateless JWT = works perfectly on Render (no sticky sessions needed).
"""
import os
from datetime import datetime, timedelta
from typing import Optional, Dict

from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ALLOWED_DOMAINS = [d.strip() for d in os.getenv("ALLOWED_DOMAINS", "").split(",") if d.strip()]


def create_jwt(data: Dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt(token: str) -> Optional[Dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def verify_google_token(credential: str) -> Optional[Dict]:
    """
    Verify a Google ID token from the frontend OAuth popup.
    Returns user info dict or None if invalid.
    """
    try:
        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        email = info.get("email", "")
        # Domain restriction (optional)
        if ALLOWED_DOMAINS:
            domain = email.split("@")[-1]
            if domain not in ALLOWED_DOMAINS:
                return None
        return {
            "email": email,
            "name": info.get("name", email.split("@")[0]),
            "picture": info.get("picture", ""),
            "sub": info.get("sub"),
            "auth_method": "google"
        }
    except Exception:
        return None
