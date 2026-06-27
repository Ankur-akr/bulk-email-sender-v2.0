"""Campaign management routes."""
from fastapi import APIRouter, HTTPException
from typing import Optional
import database

router = APIRouter()


@router.get("/")
async def list_campaigns():
    """Get all campaigns."""
    campaigns = database.get_all_campaigns()
    # Return summary (no full contact list)
    summaries = []
    for c in campaigns:
        summaries.append({
            "id": c["id"],
            "name": c["name"],
            "subject": c["subject"],
            "created_at": c["created_at"],
            "status": c["status"],
            "stats": c["stats"]
        })
    return summaries


@router.get("/dashboard")
async def dashboard_stats():
    """Get dashboard summary statistics."""
    return database.get_dashboard_stats()


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str):
    """Get campaign details including results."""
    campaign = database.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("/{campaign_id}/results")
async def get_campaign_results(
    campaign_id: str,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50
):
    """Get campaign results with optional filtering and search."""
    campaign = database.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    results = campaign.get("results", [])

    # Filter by status
    if status and status in ("sent", "failed", "pending"):
        results = [r for r in results if r["status"] == status]

    # Search by name or email
    if search:
        search_lower = search.lower()
        results = [
            r for r in results
            if search_lower in r.get("name", "").lower()
            or search_lower in r.get("email", "").lower()
        ]

    # Paginate
    total = len(results)
    start = (page - 1) * page_size
    end = start + page_size
    page_results = results[start:end]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": page_results
    }
