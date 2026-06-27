"""
In-memory database with JSON persistence for campaigns, contacts, and settings.
"""
import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

DB_FILE = "data/db.json"

def _load_db() -> Dict:
    os.makedirs("data", exist_ok=True)
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return {"campaigns": {}, "settings": _default_settings()}

def _save_db(db: Dict):
    os.makedirs("data", exist_ok=True)
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2, default=str)

def _default_settings():
    return {
        "sender_email": os.getenv("SENDER_EMAIL", ""),
        "aws_region": os.getenv("AWS_REGION", "us-east-1"),
        "delay_between_emails": 0.1,
        "max_retry_count": 3
    }

# --- Campaigns ---

def create_campaign(name: str, subject: str, body: str, contacts: List[Dict]) -> Dict:
    db = _load_db()
    cid = str(uuid.uuid4())
    campaign = {
        "id": cid,
        "name": name,
        "subject": subject,
        "body": body,
        "created_at": datetime.utcnow().isoformat(),
        "status": "pending",  # pending | sending | completed | failed
        "contacts": contacts,
        "stats": {
            "total": len(contacts),
            "sent": 0,
            "failed": 0,
            "pending": len(contacts)
        },
        "results": []
    }
    db["campaigns"][cid] = campaign
    _save_db(db)
    return campaign

def get_campaign(campaign_id: str) -> Optional[Dict]:
    db = _load_db()
    return db["campaigns"].get(campaign_id)

def get_all_campaigns() -> List[Dict]:
    db = _load_db()
    campaigns = list(db["campaigns"].values())
    return sorted(campaigns, key=lambda x: x["created_at"], reverse=True)

def update_campaign(campaign_id: str, updates: Dict) -> Optional[Dict]:
    db = _load_db()
    if campaign_id not in db["campaigns"]:
        return None
    db["campaigns"][campaign_id].update(updates)
    _save_db(db)
    return db["campaigns"][campaign_id]

def add_campaign_result(campaign_id: str, result: Dict):
    db = _load_db()
    if campaign_id not in db["campaigns"]:
        return
    campaign = db["campaigns"][campaign_id]
    campaign["results"].append(result)
    # Update stats
    if result["status"] == "sent":
        campaign["stats"]["sent"] += 1
    else:
        campaign["stats"]["failed"] += 1
    campaign["stats"]["pending"] = campaign["stats"]["total"] - campaign["stats"]["sent"] - campaign["stats"]["failed"]
    _save_db(db)

# --- Settings ---

def get_settings() -> Dict:
    db = _load_db()
    return db.get("settings", _default_settings())

def update_settings(updates: Dict) -> Dict:
    db = _load_db()
    if "settings" not in db:
        db["settings"] = _default_settings()
    db["settings"].update(updates)
    _save_db(db)
    return db["settings"]

# --- Dashboard Stats ---

def get_dashboard_stats() -> Dict:
    campaigns = get_all_campaigns()
    total_contacts = sum(c["stats"]["total"] for c in campaigns)
    total_sent = sum(c["stats"]["sent"] for c in campaigns)
    total_failed = sum(c["stats"]["failed"] for c in campaigns)
    total_pending = sum(c["stats"]["pending"] for c in campaigns)
    success_rate = (total_sent / total_contacts * 100) if total_contacts > 0 else 0
    return {
        "total_contacts": total_contacts,
        "emails_sent": total_sent,
        "failed_emails": total_failed,
        "pending_emails": total_pending,
        "success_rate": round(success_rate, 1),
        "total_campaigns": len(campaigns)
    }
