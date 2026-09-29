"""
Report download routes — streams CSV directly from PostgreSQL.
JWT is accepted through the Authorization Bearer header.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth_utils import decode_jwt
import database
from services.report_service import generate_report_bytes

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


def _get_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token: Optional[str] = Query(None),
):
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
    logger.info("Report download: campaign=%s type=%s", campaign_id, report_type)

    if report_type not in ("sent", "failed"):
        raise HTTPException(
            status_code=400,
            detail="report_type must be 'sent' or 'failed'",
        )

    # Verify campaign ownership
    campaign = await database.get_campaign(
        campaign_id,
        user_id=user["sub"],
    )

    if not campaign:
        raise HTTPException(
            status_code=404,
            detail="Campaign not found",
        )

    # Generate CSV directly from PostgreSQL
    try:
        csv_bytes = await generate_report_bytes(
            campaign_id=campaign_id,
            user_id=user["sub"],
            status_filter=report_type,
        )
    except Exception as e:
        logger.exception("Report generation failed")
        raise HTTPException(
            status_code=500,
            detail="Report generation failed",
        )

    if not csv_bytes:
        raise HTTPException(
            status_code=404,
            detail="Report is empty",
        )

    safe_name = "".join(
        c if c.isalnum() else "_"
        for c in campaign["name"]
    )

    filename = (
        f"{safe_name}_"
        f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_"
        f"{report_type}.csv"
    )

    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "text/csv",
        },
    )