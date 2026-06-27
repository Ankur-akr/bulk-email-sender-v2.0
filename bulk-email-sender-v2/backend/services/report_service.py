"""Generate per-user CSV reports and save paths back to the campaign row."""
import os, csv
from datetime import datetime
import database


async def generate_reports(campaign_id: str, user_id: str):
    """Fetch results from DB (scoped to user), write two CSV files, update campaign."""
    # Fetch ALL results for this campaign (no pagination)
    data = await database.get_campaign_results(
        campaign_id, user_id=user_id, page=1, page_size=100_000
    )
    results = data.get("results", [])

    campaign = await database.get_campaign(campaign_id, user_id=user_id)
    if not campaign:
        return None

    os.makedirs("reports", exist_ok=True)
    safe = "".join(c if c.isalnum() else "_" for c in campaign["name"])
    ts   = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    sent_path   = f"reports/{safe}_{ts}_sent.csv"
    failed_path = f"reports/{safe}_{ts}_failed.csv"
    fields      = ["name", "email", "status", "message_id", "timestamp", "error"]

    for path, status_filter in [(sent_path, "sent"), (failed_path, "failed")]:
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in results:
                if r["status"] == status_filter:
                    w.writerow({k: r.get(k, "") for k in fields})

    await database.update_campaign(campaign_id, user_id, {
        "sent_report_path":   sent_path,
        "failed_report_path": failed_path,
    })
    return {"sent": sent_path, "failed": failed_path}
