"""
Multi-tenant PostgreSQL database layer.

SECURITY MODEL
--------------
Every table that holds user data (campaigns, results, settings) carries a
user_id column — the Google `sub` (or admin email) stored in the JWT.
Every query MUST filter by user_id so no user can ever see another's data.

Public API surface (called from routes):
  create_campaign / get_campaign / get_all_campaigns / update_campaign
  add_campaign_result / get_campaign_results
  get_settings / update_settings
  get_dashboard_stats
  ensure_user                  ← call once per login to upsert the User row
"""

import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, ForeignKey,
    JSON, select, update, func, Index
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship


# ── Connection ────────────────────────────────────────────────────────────────
#
# Works with any hosted PostgreSQL (Neon, Supabase, Aiven, Railway, RDS, local).
# Put the provider's connection string in DATABASE_URL — any of these forms work:
#   postgres://user:pass@host/db
#   postgresql://user:pass@host/db?sslmode=require
#   postgresql+asyncpg://user:pass@host/db
#
# asyncpg does NOT understand libpq query params such as `sslmode` and
# `channel_binding` (providers like Neon add them to their URLs), so we strip
# them from the URL and translate them into asyncpg `connect_args`.

import logging
from sqlalchemy.engine import make_url

logger = logging.getLogger(__name__)

_RAW_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/emailsender",
).strip()

# Query params that libpq understands but asyncpg rejects
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding", "sslrootcert", "sslcert", "sslkey", "options"}
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db", "postgres"}


def _build_engine_config(raw_url: str):
    url = make_url(raw_url)

    # Force the asyncpg driver whatever prefix the provider gave us
    url = url.set(drivername="postgresql+asyncpg")

    query = dict(url.query)
    sslmode = str(query.get("sslmode", "")).lower()
    for key in list(query):
        if key in _LIBPQ_ONLY_PARAMS:
            query.pop(key)
    # Also honour an explicit ?ssl=... if someone already wrote it asyncpg-style
    ssl_param = str(query.pop("ssl", "")).lower()
    url = url.set(query=query)

    host = (url.host or "").lower()
    unix_socket = str(query.get("host", "")).startswith("/")
    is_local = (not host) or unix_socket or host in _LOCAL_HOSTS or host.endswith(".local")

    connect_args = {}

    # ── SSL ──
    # Hosted databases require TLS. Local dev databases usually don't.
    wanted = sslmode or ssl_param
    if wanted in ("disable", "false", "0"):
        pass
    elif wanted in ("verify-ca", "verify-full"):
        connect_args["ssl"] = wanted
    elif wanted in ("require", "prefer", "allow", "true", "1"):
        connect_args["ssl"] = "require"       # encrypted, like libpq sslmode=require
    elif not is_local:
        connect_args["ssl"] = "require"       # safe default for any remote host

    # ── PgBouncer / pooled endpoints ──
    # Transaction-mode poolers (Supabase :6543, Neon "-pooler" hosts) break
    # asyncpg's prepared-statement cache, so switch it off for them.
    port = url.port or 5432
    if "pooler" in host or port == 6543 or os.getenv("DB_USE_POOLER", "").lower() in ("1", "true", "yes"):
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid.uuid4()}__"

    # Fail fast instead of hanging forever if the DB is unreachable / waking up
    connect_args["timeout"] = int(os.getenv("DB_CONNECT_TIMEOUT", "30"))

    return url, connect_args


DATABASE_URL, _CONNECT_ARGS = _build_engine_config(_RAW_URL)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_CONNECT_ARGS,
    pool_pre_ping=True,                                   # drop dead connections silently
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "300")),  # serverless DBs close idle conns
    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "5")),
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


# ── ORM Models ────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class User(Base):
    """
    One row per unique authenticated user.
    user_id = Google `sub` for OAuth users, or email for admin/password users.
    This is the anchor for all tenant-scoped data.
    """
    __tablename__ = "users"

    id         = Column(String, primary_key=True)   # Google sub or email
    email      = Column(String, unique=True, nullable=False)
    name       = Column(String, nullable=True)
    picture    = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaigns = relationship("Campaign", back_populates="user", cascade="all, delete-orphan")
    settings  = relationship("UserSettings", back_populates="user", uselist=False,
                             cascade="all, delete-orphan")


class Campaign(Base):
    __tablename__ = "campaigns"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # ← TENANT KEY: every query must filter by this
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String, nullable=False)
    subject    = Column(String, nullable=False)
    body       = Column(Text,   nullable=False)
    body_html  = Column(Text,   nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status     = Column(String, default="pending")   # pending|sending|completed|failed
    total      = Column(Integer, default=0)
    sent       = Column(Integer, default=0)
    failed     = Column(Integer, default=0)
    # CSV report file paths (populated after campaign completes)
    sent_report_path   = Column(String, nullable=True)
    failed_report_path = Column(String, nullable=True)

    user    = relationship("User", back_populates="campaigns")
    results = relationship("Result", back_populates="campaign",
                           cascade="all, delete-orphan", passive_deletes=True)


# Composite index so per-user queries are fast even with millions of rows
Index("ix_campaigns_user_id_created", Campaign.user_id, Campaign.created_at.desc())


class Result(Base):
    __tablename__ = "results"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    # Denormalised for fast per-user report queries without an extra JOIN
    user_id     = Column(String, ForeignKey("users.id",     ondelete="CASCADE"), nullable=False)
    name        = Column(String)
    email       = Column(String)
    status      = Column(String)        # sent | failed
    message_id  = Column(String, nullable=True)
    error       = Column(Text,   nullable=True)
    timestamp   = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="results")


Index("ix_results_campaign_id", Result.campaign_id)
Index("ix_results_user_id",     Result.user_id)


class UserSettings(Base):
    """
    Per-user AWS / sending settings.
    Each user configures their own SES credentials & preferences.
    """
    __tablename__ = "user_settings"

    user_id              = Column(String, ForeignKey("users.id", ondelete="CASCADE"),
                                  primary_key=True)
    sender_email         = Column(String,  default="")
    aws_region           = Column(String,  default="us-east-1")
    delay_between_emails = Column(Float,   default=0.1)
    max_retry_count      = Column(Integer, default=3)

    user = relationship("User", back_populates="settings")

    def to_dict(self):
        return {
            "sender_email":         self.sender_email,
            "aws_region":           self.aws_region,
            "delay_between_emails": self.delay_between_emails,
            "max_retry_count":      self.max_retry_count,
        }


# ── DB Init ───────────────────────────────────────────────────────────────────

async def init_db(retries: int = 5, delay: float = 3.0):
    """
    Create all tables (idempotent). Called once at app startup.
    Retries because serverless Postgres (e.g. Neon) may need a few seconds
    to wake up from idle.
    """
    import asyncio
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database ready (attempt %d)", attempt)
            return
        except Exception as e:  # noqa: BLE001
            last_err = e
            logger.warning("Database not ready (attempt %d/%d): %s", attempt, retries, e)
            await asyncio.sleep(delay * attempt)
    logger.error("Could not connect to the database. Check DATABASE_URL.")
    raise last_err


async def ping() -> bool:
    """Cheap connectivity check used by /api/health/db."""
    from sqlalchemy import text
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return True


# ── User management ───────────────────────────────────────────────────────────

async def ensure_user(user_id: str, email: str, name: str = "", picture: str = "") -> Dict:
    """
    Upsert the User row on every login.
    Returns the user dict so auth routes can embed it in the JWT.
    """
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if user:
            user.last_login = datetime.utcnow()
            user.name       = name or user.name
            user.picture    = picture or user.picture
        else:
            user = User(id=user_id, email=email, name=name, picture=picture)
            session.add(user)
        await session.commit()
        await session.refresh(user)
        return {"id": user.id, "email": user.email, "name": user.name, "picture": user.picture}


# ── Campaign CRUD (all filtered by user_id) ───────────────────────────────────

async def create_campaign(
    user_id: str, name: str, subject: str, body: str,
    contacts: List[Dict], body_html: Optional[str] = None
) -> Dict:
    async with AsyncSessionLocal() as session:
        cid = str(uuid.uuid4())
        campaign = Campaign(
            id=cid, user_id=user_id,
            name=name, subject=subject, body=body, body_html=body_html,
            total=len(contacts),
        )
        session.add(campaign)
        await session.commit()
        await session.refresh(campaign)
        return _campaign_to_dict(campaign)


async def get_campaign(campaign_id: str, user_id: str) -> Optional[Dict]:
    """Returns None if campaign doesn't exist OR belongs to a different user."""
    async with AsyncSessionLocal() as session:
        row = (await session.execute(
            select(Campaign)
            .where(Campaign.id == campaign_id, Campaign.user_id == user_id)
        )).scalar_one_or_none()
        return _campaign_to_dict(row) if row else None


async def get_all_campaigns(user_id: str) -> List[Dict]:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(Campaign)
            .where(Campaign.user_id == user_id)
            .order_by(Campaign.created_at.desc())
        )).scalars().all()
        return [_campaign_to_dict(r) for r in rows]


async def update_campaign(campaign_id: str, user_id: str, updates: Dict) -> Optional[Dict]:
    # Map friendly key names → column names
    col_map = {
        "status":             Campaign.status,
        "sent_report_path":   Campaign.sent_report_path,
        "failed_report_path": Campaign.failed_report_path,
    }
    values = {k: v for k, v in updates.items() if k in col_map}
    if not values:
        return await get_campaign(campaign_id, user_id)

    async with AsyncSessionLocal() as session:
        await session.execute(
            update(Campaign)
            .where(Campaign.id == campaign_id, Campaign.user_id == user_id)
            .values(**values)
        )
        await session.commit()
    return await get_campaign(campaign_id, user_id)


async def add_campaign_result(campaign_id: str, user_id: str, result_data: Dict):
    async with AsyncSessionLocal() as session:
        row = Result(
            campaign_id=campaign_id,
            user_id=user_id,
            name=result_data.get("name"),
            email=result_data.get("email"),
            status=result_data.get("status"),
            message_id=result_data.get("message_id"),
            error=result_data.get("error"),
            timestamp=(
                datetime.fromisoformat(result_data["timestamp"])
                if result_data.get("timestamp") else datetime.utcnow()
            ),
        )
        session.add(row)

        # Atomically increment the counter on the campaign row
        if result_data.get("status") == "sent":
            await session.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id, Campaign.user_id == user_id)
                .values(sent=Campaign.sent + 1)
            )
        else:
            await session.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id, Campaign.user_id == user_id)
                .values(failed=Campaign.failed + 1)
            )
        await session.commit()


async def get_campaign_results(
    campaign_id: str, user_id: str,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1, page_size: int = 50,
) -> Dict:
    async with AsyncSessionLocal() as session:
        q = (
            select(Result)
            .where(Result.campaign_id == campaign_id, Result.user_id == user_id)
        )
        if status in ("sent", "failed"):
            q = q.where(Result.status == status)
        if search:
            like = f"%{search}%"
            q = q.where((Result.name.ilike(like)) | (Result.email.ilike(like)))

        total = (await session.execute(
            select(func.count()).select_from(q.subquery())
        )).scalar_one()

        rows = (await session.execute(
            q.order_by(Result.timestamp)
             .offset((page - 1) * page_size)
             .limit(page_size)
        )).scalars().all()

        return {
            "total": total, "page": page, "page_size": page_size,
            "results": [_result_to_dict(r) for r in rows],
        }


# ── Settings (per user) ───────────────────────────────────────────────────────

async def get_settings(user_id: str) -> Dict:
    async with AsyncSessionLocal() as session:
        s = await session.get(UserSettings, user_id)
        if not s:
            # First access — create default settings for this user
            s = UserSettings(
                user_id=user_id,
                sender_email=os.getenv("SENDER_EMAIL", ""),
                aws_region=os.getenv("AWS_REGION", "us-east-1"),
            )
            session.add(s)
            await session.commit()
            await session.refresh(s)
        return s.to_dict()


async def update_settings(user_id: str, updates: Dict) -> Dict:
    async with AsyncSessionLocal() as session:
        s = await session.get(UserSettings, user_id)
        if not s:
            s = UserSettings(user_id=user_id)
            session.add(s)
        for key, value in updates.items():
            if hasattr(s, key):
                setattr(s, key, value)
        await session.commit()
        await session.refresh(s)
        return s.to_dict()


# ── Dashboard (per user) ──────────────────────────────────────────────────────

async def get_dashboard_stats(user_id: str) -> Dict:
    async with AsyncSessionLocal() as session:
        row = (await session.execute(
            select(
                func.count(Campaign.id).label("total_campaigns"),
                func.coalesce(func.sum(Campaign.total),  0).label("total_contacts"),
                func.coalesce(func.sum(Campaign.sent),   0).label("emails_sent"),
                func.coalesce(func.sum(Campaign.failed), 0).label("failed_emails"),
            ).where(Campaign.user_id == user_id)   # ← scoped to this user
        )).one()

    total  = int(row.total_contacts)
    sent   = int(row.emails_sent)
    failed = int(row.failed_emails)
    return {
        "total_campaigns": int(row.total_campaigns),
        "total_contacts":  total,
        "emails_sent":     sent,
        "failed_emails":   failed,
        "pending_emails":  max(0, total - sent - failed),
        "success_rate":    round(sent / total * 100, 1) if total > 0 else 0.0,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _campaign_to_dict(c: Campaign) -> Dict:
    return {
        "id":         c.id,
        "user_id":    c.user_id,
        "name":       c.name,
        "subject":    c.subject,
        "body":       c.body,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "status":     c.status,
        "stats": {
            "total":   c.total,
            "sent":    c.sent,
            "failed":  c.failed,
            "pending": max(0, c.total - c.sent - c.failed),
        },
        "reports": {
            "sent":   c.sent_report_path,
            "failed": c.failed_report_path,
        },
    }


def _result_to_dict(r: Result) -> Dict:
    return {
        "name":       r.name,
        "email":      r.email,
        "status":     r.status,
        "message_id": r.message_id,
        "error":      r.error,
        "timestamp":  r.timestamp.isoformat() if r.timestamp else None,
    }
