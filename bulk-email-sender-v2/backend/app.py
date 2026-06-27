"""
Bulk Personalized Email Sender - FastAPI Backend
Production-ready with Google OAuth, JWT, and Render deployment support
"""
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from routes import auth, campaigns, contacts, emails, reports, settings

# Create required directories
for d in ["uploads", "reports", "logs", "templates", "data"]:
    os.makedirs(d, exist_ok=True)

# Logging
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
    description="Production-ready bulk personalized email sending service",
    version="2.0.0"
)

# ── CORS (allow Vercel frontend + local dev) ──────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
origins = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
]
# Also allow any Vercel preview deployments automatically
if "vercel.app" in FRONTEND_URL:
    base = FRONTEND_URL.split(".vercel.app")[0].rsplit("-", 1)[0]
    origins.append(f"{base}-*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static report files
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

# Routers
app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(contacts.router,  prefix="/api/contacts",  tags=["contacts"])
app.include_router(emails.router,    prefix="/api/emails",    tags=["emails"])
app.include_router(reports.router,   prefix="/api/reports",   tags=["reports"])
app.include_router(settings.router,  prefix="/api/settings",  tags=["settings"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
