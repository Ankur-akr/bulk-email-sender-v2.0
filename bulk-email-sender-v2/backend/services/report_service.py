"""Generate per-user CSV reports — streamed directly, no disk storage needed."""
import csv
import io
from datetime import datetime
import database


async def generate_report_bytes(campaign_id: str, user_id: str, status_filter: str) -> bytes:
    """Fetch results from DB and return CSV bytes for the given status filter."""
    data = await database.get_campaign_results(
        campaign_id, user_id=user_id, page=1, page_size=100_000
    )
    results = data.get("results", [])

    fields = ["name", "email", "status", "message_id", "timestamp", "error"]
    output = io.StringIO()
    w = csv.DictWriter(output, fieldnames=fields)
    w.writeheader()
    for r in results:
        if r["status"] == status_filter:
            w.writerow({k: r.get(k, "") for k in fields})

    return output.getvalue().encode("utf-8")


async def generate_reports(campaign_id: str, user_id: str):
    """Legacy compatibility — just return empty paths, reports are now streamed."""
    return {"sent": None, "failed": None}