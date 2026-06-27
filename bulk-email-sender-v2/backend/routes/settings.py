"""Per-user settings routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import database
from routes.auth import get_current_user

router = APIRouter()


class SettingsUpdate(BaseModel):
    sender_email:         Optional[str]   = None
    aws_region:           Optional[str]   = None
    delay_between_emails: Optional[float] = None
    max_retry_count:      Optional[int]   = None


@router.get("/")
async def get_settings(user=Depends(get_current_user)):
    return await database.get_settings(user_id=user["sub"])


@router.put("/")
async def update_settings(body: SettingsUpdate, user=Depends(get_current_user)):
    data = {k: v for k, v in body.dict().items() if v is not None}
    return await database.update_settings(user_id=user["sub"], updates=data)
