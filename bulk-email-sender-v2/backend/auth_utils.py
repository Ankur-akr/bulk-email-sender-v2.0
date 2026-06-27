"""
JWT utilities.
The JWT payload always contains:
  sub      — unique stable user ID (Google `sub`, or email for admin)
  email    — user email
  name     — display name
  picture  — avatar URL
  auth_method — "google" | "password"
"""
import os
from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt

SECRET_KEY    = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
ALGORITHM     = os.getenv("JWT_ALGORITHM",  "HS256")
EXPIRE_HOURS  = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def create_jwt(data: Dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(hours=EXPIRE_HOURS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt(token: str) -> Optional[Dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
