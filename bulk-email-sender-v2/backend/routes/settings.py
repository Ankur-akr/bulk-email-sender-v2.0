"""Settings routes."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import database

router = APIRouter()


class SettingsUpdate(BaseModel):
    sender_email: Optional[str] = None
    aws_region: Optional[str] = None
    delay_between_emails: Optional[float] = None
    max_retry_count: Optional[int] = None


@router.get("/")
async def get_settings():
    return await database.get_settings()


@router.put("/")
async def update_settings(updates: SettingsUpdate):
    data = {k: v for k, v in updates.dict().items() if v is not None}
    return await database.update_settings(data)
