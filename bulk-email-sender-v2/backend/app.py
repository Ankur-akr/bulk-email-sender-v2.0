"""
Bulk Personalized Email Sender - FastAPI Backend
PostgreSQL edition (SQLAlchemy async + asyncpg)
"""
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from routes import auth, campaigns, contacts, emails, reports, settings

# Create required directories
for d in ["uploads", "reports", "logs", "templates"]:
    os.makedirs(d, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Bulk Email Sender API",
    description="Production-ready bulk personalized email sending service (PostgreSQL)",
    version="3.0.0"
)

# ── Startup: create tables ────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await init_db()
    logger.info("Database initialised")

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# EXTRA_ORIGINS: comma-separated extra URLs (e.g. Vercel preview URLs)
extra = [u.strip() for u in os.getenv("EXTRA_ORIGINS", "").split(",") if u.strip()]

origins = list({
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    *extra,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/reports", StaticFiles(directory="reports"), name="reports")

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(contacts.router,  prefix="/api/contacts",  tags=["contacts"])
app.include_router(emails.router,    prefix="/api/emails",    tags=["emails"])
app.include_router(reports.router,   prefix="/api/reports",   tags=["reports"])
app.include_router(settings.router,  prefix="/api/settings",  tags=["settings"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "3.0.0", "db": "postgresql"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)