"""Email sending routes with background processing and SSE progress streaming."""
import asyncio
import time
import re
from datetime import datetime
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

import database
from services.email_service import ses_service

router = APIRouter()

# In-memory progress tracker keyed by campaign_id
progress_store: Dict[str, Dict] = {}


class SendEmailRequest(BaseModel):
    campaign_name: str
    subject: str
    body: str
    body_html: Optional[str] = None
    contacts: List[Dict]
    sender_email: Optional[str] = None
    delay_seconds: float = 0.1
    max_retries: int = 3


def replace_placeholders(text: str, contact: Dict) -> str:
    """Replace {name}, {email}, and any other {field} placeholders."""
    for key, value in contact.items():
        text = text.replace(f"{{{key}}}", str(value))
    return text


async def send_campaign_async(campaign_id: str, request: SendEmailRequest):
    """Background task: send emails and update progress."""
    campaign = database.get_campaign(campaign_id)
    if not campaign:
        return

    database.update_campaign(campaign_id, {"status": "sending"})
    progress_store[campaign_id] = {
        "total": len(request.contacts),
        "sent": 0,
        "failed": 0,
        "current_email": "",
        "status": "sending"
    }

    settings = database.get_settings()
    delay = request.delay_seconds or settings.get("delay_between_emails", 0.1)
    retries = request.max_retries or settings.get("max_retry_count", 3)
    sender = request.sender_email or settings.get("sender_email", "")

    for contact in request.contacts:
        name = contact.get("name", "")
        email = contact.get("email", "")

        progress_store[campaign_id]["current_email"] = email

        # Personalize subject and body
        subject = replace_placeholders(request.subject, contact)
        body_text = replace_placeholders(request.body, contact)
        body_html = replace_placeholders(request.body_html, contact) if request.body_html else None

        result = ses_service.send_email(
            to_email=email,
            to_name=name,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            sender_email=sender,
            max_retries=retries,
        )

        record = {
            "name": name,
            "email": email,
            "status": result["status"],
            "message_id": result.get("message_id"),
            "timestamp": datetime.utcnow().isoformat(),
            "error": result.get("error"),
        }
        database.add_campaign_result(campaign_id, record)

        # Update progress
        if result["status"] == "sent":
            progress_store[campaign_id]["sent"] += 1
        else:
            progress_store[campaign_id]["failed"] += 1

        # Respect rate limiting
        await asyncio.sleep(delay)

    # Mark campaign complete
    database.update_campaign(campaign_id, {"status": "completed"})
    progress_store[campaign_id]["status"] = "completed"

    # Generate reports
    from services.report_service import generate_reports
    generate_reports(campaign_id)


@router.post("/send")
async def send_emails(req: SendEmailRequest, background_tasks: BackgroundTasks):
    """Start a new email campaign."""
    if not req.contacts:
        raise HTTPException(status_code=400, detail="No contacts provided")

    campaign = database.create_campaign(
        name=req.campaign_name,
        subject=req.subject,
        body=req.body,
        contacts=req.contacts
    )

    background_tasks.add_task(send_campaign_async, campaign["id"], req)
    return {"campaign_id": campaign["id"], "message": "Campaign started", "total": len(req.contacts)}


@router.get("/progress/{campaign_id}")
async def get_progress(campaign_id: str):
    """Get current sending progress for a campaign."""
    prog = progress_store.get(campaign_id)
    if not prog:
        campaign = database.get_campaign(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        stats = campaign["stats"]
        return {
            "total": stats["total"],
            "sent": stats["sent"],
            "failed": stats["failed"],
            "pending": stats["pending"],
            "status": campaign["status"],
            "current_email": ""
        }

    total = prog["total"]
    sent = prog["sent"]
    failed = prog["failed"]
    done = sent + failed
    return {
        "total": total,
        "sent": sent,
        "failed": failed,
        "pending": total - done,
        "percentage": round(done / total * 100, 1) if total > 0 else 0,
        "status": prog["status"],
        "current_email": prog.get("current_email", "")
    }


@router.get("/progress-stream/{campaign_id}")
async def progress_stream(campaign_id: str):
    """Server-Sent Events stream for live progress updates."""
    async def event_generator():
        while True:
            prog = progress_store.get(campaign_id)
            if not prog:
                campaign = database.get_campaign(campaign_id)
                if campaign:
                    stats = campaign["stats"]
                    data = {
                        "total": stats["total"],
                        "sent": stats["sent"],
                        "failed": stats["failed"],
                        "pending": stats["pending"],
                        "percentage": 0,
                        "status": campaign["status"]
                    }
                else:
                    data = {"status": "not_found"}
            else:
                total = prog["total"]
                done = prog["sent"] + prog["failed"]
                data = {
                    "total": total,
                    "sent": prog["sent"],
                    "failed": prog["failed"],
                    "pending": total - done,
                    "percentage": round(done / total * 100, 1) if total > 0 else 0,
                    "status": prog["status"],
                    "current_email": prog.get("current_email", "")
                }

            yield f"data: {json.dumps(data)}\n\n"

            if data.get("status") in ("completed", "failed", "not_found"):
                break
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/verify-credentials")
async def verify_credentials():
    """Verify AWS SES credentials."""
    result = ses_service.verify_credentials()
    return result
