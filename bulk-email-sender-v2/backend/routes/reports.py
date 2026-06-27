"""Reports download routes — supports JWT via query param for direct download links."""
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
import database
from services.report_service import generate_reports
from auth_utils import decode_jwt

router = APIRouter()


def _verify_token(token: str = Query(None)):
    """Allow JWT as a query param so download links work directly in browser."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


@router.get("/{campaign_id}/download/{report_type}")
async def download_report(
    campaign_id: str,
    report_type: str,
    token: str = Query(None)
):
    _verify_token(token)

    if report_type not in ("sent", "failed"):
        raise HTTPException(status_code=400, detail="Type must be 'sent' or 'failed'")

    campaign = database.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    reports = campaign.get("reports", {})
    if report_type not in reports or not os.path.exists(reports.get(report_type, "")):
        reports = generate_reports(campaign_id) or {}
        campaign = database.get_campaign(campaign_id)
        reports = campaign.get("reports", {})

    path = reports.get(report_type)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not yet generated")

    return FileResponse(path, media_type="text/csv", filename=os.path.basename(path))


@router.post("/{campaign_id}/generate")
async def generate_campaign_reports(campaign_id: str, token: str = Query(None)):
    _verify_token(token)
    campaign = database.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    result = generate_reports(campaign_id)
    return {"message": "Reports generated", "paths": result}
