"""Campaign routes — every query scoped to the authenticated user."""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import database
from routes.auth import get_current_user

router = APIRouter()


@router.get("/dashboard")
async def dashboard_stats(user=Depends(get_current_user)):
    return await database.get_dashboard_stats(user_id=user["sub"])


@router.get("/")
async def list_campaigns(user=Depends(get_current_user)):
    campaigns = await database.get_all_campaigns(user_id=user["sub"])
    # Strip verbose fields not needed in list view
    return [
        {k: v for k, v in c.items() if k not in ("body", "reports")}
        for c in campaigns
    ]


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, user=Depends(get_current_user)):
    # get_campaign already filters by user_id — returns None if not owner
    c = await database.get_campaign(campaign_id, user_id=user["sub"])
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


@router.get("/{campaign_id}/results")
async def campaign_results(
    campaign_id: str,
    status:    Optional[str] = Query(None),
    search:    Optional[str] = Query(None),
    page:      int           = Query(1,  ge=1),
    page_size: int           = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
):
    # Confirm the campaign belongs to this user before returning results
    c = await database.get_campaign(campaign_id, user_id=user["sub"])
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return await database.get_campaign_results(
        campaign_id, user_id=user["sub"],
        status=status, search=search,
        page=page, page_size=page_size,
    )
