"""
Report download routes.

Security: campaign ownership is verified before serving any file.
JWT accepted as Bearer header OR ?token= query param
(query param lets browser <a href> download links work directly).
"""
import os
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from auth_utils import decode_jwt
import database

router   = APIRouter()
security = HTTPBearer(auto_error=False)


def _get_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token: Optional[str] = Query(None),
) -> dict:
    """Accept JWT from header OR ?token= query param."""
    raw = (creds.credentials if creds else None) or token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt(raw)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


@router.get("/{campaign_id}/download/{report_type}")
async def download_report(
    campaign_id: str,
    report_type: str,
    user=Depends(_get_user),
):
    if report_type not in ("sent", "failed"):
        raise HTTPException(status_code=400, detail="report_type must be 'sent' or 'failed'")

    # Ownership check — returns None if campaign belongs to someone else
    campaign = await database.get_campaign(campaign_id, user_id=user["sub"])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    reports = campaign.get("reports", {})
    path    = reports.get(report_type)

    # Generate on-demand if missing
    if not path or not os.path.exists(path):
        from services.report_service import generate_reports
        paths = await generate_reports(campaign_id, user["sub"])
        path  = (paths or {}).get(report_type)

    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not available yet")

    return FileResponse(path, media_type="text/csv", filename=os.path.basename(path))
