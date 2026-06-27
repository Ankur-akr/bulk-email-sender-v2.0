"""Campaign management routes."""
from fastapi import APIRouter, HTTPException
from typing import Optional
import database

router = APIRouter()


@router.get("/")
async def list_campaigns():
    campaigns = await database.get_all_campaigns()
    return [
        {
            "id": c["id"], "name": c["name"], "subject": c["subject"],
            "created_at": c["created_at"], "status": c["status"], "stats": c["stats"],
        }
        for c in campaigns
    ]


@router.get("/dashboard")
async def dashboard_stats():
    return await database.get_dashboard_stats()


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str):
    campaign = await database.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("/{campaign_id}/results")
async def get_campaign_results(
    campaign_id: str,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    campaign = await database.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    results = campaign.get("results", [])

    if status and status in ("sent", "failed", "pending"):
        results = [r for r in results if r["status"] == status]

    if search:
        sl = search.lower()
        results = [
            r for r in results
            if sl in r.get("name", "").lower() or sl in r.get("email", "").lower()
        ]

    total = len(results)
    start = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size, "results": results[start:start + page_size]}
