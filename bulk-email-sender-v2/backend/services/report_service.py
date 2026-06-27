"""Report generation service."""
import os
import csv
from datetime import datetime
import database


def generate_reports(campaign_id: str):
    """Generate sent and failed CSV reports for a campaign."""
    campaign = database.get_campaign(campaign_id)
    if not campaign:
        return

    results = campaign.get("results", [])
    os.makedirs("reports", exist_ok=True)

    safe_name = "".join(c if c.isalnum() else "_" for c in campaign["name"])
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    sent_path = f"reports/{safe_name}_{ts}_sent.csv"
    failed_path = f"reports/{safe_name}_{ts}_failed.csv"

    fieldnames = ["name", "email", "status", "message_id", "timestamp", "error"]

    with open(sent_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in results:
            if r["status"] == "sent":
                w.writerow({k: r.get(k, "") for k in fieldnames})

    with open(failed_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in results:
            if r["status"] == "failed":
                w.writerow({k: r.get(k, "") for k in fieldnames})

    database.update_campaign(campaign_id, {
        "reports": {
            "sent": sent_path,
            "failed": failed_path
        }
    })
    return {"sent": sent_path, "failed": failed_path}
