"""Email sending routes — all operations scoped to the authenticated user."""
import asyncio
import json
from datetime import datetime
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import database
from services.email_service import ses_service
from routes.auth import get_current_user

router = APIRouter()

# In-memory progress tracker — keyed by campaign_id.
# Only lives while a campaign is actively sending; no cross-user data risk
# because campaign IDs are UUIDs and each user only knows their own IDs.
progress_store: Dict[str, Dict] = {}


class SendEmailRequest(BaseModel):
    campaign_name: str
    subject:       str
    body:          str
    body_html:     Optional[str] = None
    contacts:      List[Dict]
    sender_email:  Optional[str] = None
    delay_seconds: float = 0.1
    max_retries:   int   = 3


def _replace(text: str, contact: Dict) -> str:
    for k, v in contact.items():
        text = text.replace(f"{{{k}}}", str(v))
    return text


async def _send_campaign(campaign_id: str, user_id: str, req: SendEmailRequest):
    """Background task — writes every result to Postgres under the user's tenant."""
    try:
        await database.update_campaign(campaign_id, user_id, {"status": "sending"})
        progress_store[campaign_id] = {
            "total": len(req.contacts), "sent": 0, "failed": 0,
            "current_email": "", "status": "sending",
        }

        settings = await database.get_settings(user_id)
        delay    = req.delay_seconds or settings.get("delay_between_emails", 0.1)
        retries  = req.max_retries   or settings.get("max_retry_count", 3)
        sender   = req.sender_email  or settings.get("sender_email", "")

        for contact in req.contacts:
            name  = contact.get("name",  "")
            email = contact.get("email", "")
            progress_store[campaign_id]["current_email"] = email

            # boto3 is blocking (and retries use time.sleep) — run it in a worker
            # thread so the API stays responsive while a campaign is sending.
            result = await asyncio.to_thread(
                ses_service.send_email,
                to_email=email, to_name=name,
                subject=_replace(req.subject, contact),
                body_text=_replace(req.body, contact),
                body_html=_replace(req.body_html, contact) if req.body_html else None,
                sender_email=sender, max_retries=retries,
            )

            await database.add_campaign_result(campaign_id, user_id, {
                "name": name, "email": email,
                "status":     result["status"],
                "message_id": result.get("message_id"),
                "timestamp":  datetime.utcnow().isoformat(),
                "error":      result.get("error"),
            })

            if result["status"] == "sent":
                progress_store[campaign_id]["sent"] += 1
            else:
                progress_store[campaign_id]["failed"] += 1

            await asyncio.sleep(delay)

        await database.update_campaign(campaign_id, user_id, {"status": "completed"})
        progress_store[campaign_id]["status"] = "completed"

        # Finished — the DB is now the source of truth, drop the in-memory entry
        # after clients have had time to read the final "completed" state.
        await asyncio.sleep(10)
        progress_store.pop(campaign_id, None)

    except Exception:
        await database.update_campaign(campaign_id, user_id, {"status": "failed"})
        progress_store.setdefault(campaign_id, {
            "total": len(req.contacts), "sent": 0, "failed": 0, "current_email": "",
        })["status"] = "failed"
        raise


@router.post("/send")
async def send_emails(
    req: SendEmailRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    if not req.contacts:
        raise HTTPException(status_code=400, detail="No contacts provided")

    campaign = await database.create_campaign(
        user_id=user["sub"],
        name=req.campaign_name, subject=req.subject,
        body=req.body, body_html=req.body_html,
        contacts=req.contacts,
    )
    background_tasks.add_task(_send_campaign, campaign["id"], user["sub"], req)
    return {"campaign_id": campaign["id"], "message": "Campaign started", "total": len(req.contacts)}


@router.get("/progress/{campaign_id}")
async def get_progress(campaign_id: str, user=Depends(get_current_user)):
    # Verify ownership first — progress_store is keyed only by campaign id
    owned = await database.get_campaign(campaign_id, user_id=user["sub"])
    if not owned:
        raise HTTPException(status_code=404, detail="Campaign not found")

    prog = progress_store.get(campaign_id)
    if prog:
        total = prog["total"]
        done  = prog["sent"] + prog["failed"]
        return {
            "total": total, "sent": prog["sent"], "failed": prog["failed"],
            "pending": total - done,
            "percentage": round(done / total * 100, 1) if total else 0,
            "status": prog["status"],
            "current_email": prog.get("current_email", ""),
        }

    c = owned
    stats = c["stats"]
    done  = stats["sent"] + stats["failed"]
    return {
        "total": stats["total"], "sent": stats["sent"],
        "failed": stats["failed"], "pending": stats["pending"],
        "percentage": round(done / stats["total"] * 100, 1) if stats["total"] else 0,
        "status": c["status"], "current_email": "",
    }


@router.post("/verify-credentials")
async def verify_credentials(user=Depends(get_current_user)):
    return ses_service.verify_credentials()
