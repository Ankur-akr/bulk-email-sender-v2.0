"""
Report download routes — streams CSV directly from DB, no disk dependency.
JWT accepted as Bearer header OR ?token= query param.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime
from auth_utils import decode_jwt
import database
from services.report_service import generate_report_bytes

router   = APIRouter()
security = HTTPBearer(auto_error=False)


def _get_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token: Optional[str] = Query(None),
) -> dict:
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
    print("DOWNLOAD ENDPOINT HIT")
    if report_type not in ("sent", "failed"):
        raise HTTPException(status_code=400, detail="report_type must be 'sent' or 'failed'")

    # Ownership check
    campaign = await database.get_campaign(campaign_id, user_id=user["sub"])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    csv_bytes = await generate_report_bytes(campaign_id, user["sub"], report_type)

    safe = "".join(c if c.isalnum() else "_" for c in campaign["name"])
    ts   = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe}_{ts}_{report_type}.csv"

    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )