"""
Bulk Email Sender v3 — FastAPI entry point.
Multi-tenant: every request is scoped to the authenticated user via JWT sub.
"""
import os, logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from database import init_db, ping
from routes import auth, campaigns, contacts, emails, reports, settings

for d in ["reports", "logs", "uploads"]:
    os.makedirs(d, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler("logs/app.log"), logging.StreamHandler()],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()   # create tables on startup (idempotent)
    yield


app = FastAPI(title="Bulk Email Sender API", version="3.0.0", lifespan=lifespan)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],   # lets the browser read the CSV filename
)

app.mount("/reports", StaticFiles(directory="reports"), name="reports")

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(contacts.router,  prefix="/api/contacts",  tags=["contacts"])
app.include_router(emails.router,    prefix="/api/emails",    tags=["emails"])
app.include_router(reports.router,   prefix="/api/reports",   tags=["reports"])
app.include_router(settings.router,  prefix="/api/settings",  tags=["settings"])


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health():
    """Lightweight liveness check (also used to wake the Render free web service)."""
    return {"status": "healthy", "version": "3.0.0"}


@app.get("/api/health/db")
async def health_db():
    """Verifies the app can actually reach PostgreSQL — use this when debugging DATABASE_URL."""
    try:
        await ping()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Database unreachable: {type(e).__name__}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)