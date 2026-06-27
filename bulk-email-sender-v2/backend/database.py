"""
PostgreSQL database layer using SQLAlchemy (async) + asyncpg.
Replaces the previous JSON-file-based in-memory store.

Schema:
  campaigns  – one row per campaign
  contacts   – one row per contact (linked to a campaign)
  results    – one row per send result (linked to a campaign)
  settings   – single-row key-value config table
"""

import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, ForeignKey,
    JSON, select, update, func, create_engine, text
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

# ── Connection ────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/emailsender")

# Render / Heroku supply postgres:// – fix the scheme for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
# If a plain postgresql:// URL is given, also add the +asyncpg driver
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


# ── ORM Models ────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class Campaign(Base):
    __tablename__ = "campaigns"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name        = Column(String, nullable=False)
    subject     = Column(String, nullable=False)
    body        = Column(Text, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    status      = Column(String, default="pending")   # pending|sending|completed|failed
    total       = Column(Integer, default=0)
    sent        = Column(Integer, default=0)
    failed      = Column(Integer, default=0)

    contacts    = relationship("Contact", back_populates="campaign", cascade="all, delete-orphan")
    results     = relationship("Result",  back_populates="campaign", cascade="all, delete-orphan")


class Contact(Base):
    __tablename__ = "contacts"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String, nullable=False)
    email       = Column(String, nullable=False)
    extra       = Column(JSON, default=dict)   # any additional CSV columns

    campaign    = relationship("Campaign", back_populates="contacts")


class Result(Base):
    __tablename__ = "results"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String)
    email       = Column(String)
    status      = Column(String)               # sent | failed
    message_id  = Column(String, nullable=True)
    error       = Column(Text, nullable=True)
    timestamp   = Column(DateTime, default=datetime.utcnow)

    campaign    = relationship("Campaign", back_populates="results")


class Setting(Base):
    __tablename__ = "settings"

    key   = Column(String, primary_key=True)
    value = Column(Text)


# ── DB init ───────────────────────────────────────────────────────────────────

async def init_db():
    """Create all tables (idempotent). Call once at startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default settings if the table is empty
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Setting))
        if not result.scalars().first():
            defaults = {
                "sender_email":          os.getenv("SENDER_EMAIL", ""),
                "aws_region":            os.getenv("AWS_REGION", "us-east-1"),
                "delay_between_emails":  "0.1",
                "max_retry_count":       "3",
            }
            session.add_all([Setting(key=k, value=str(v)) for k, v in defaults.items()])
            await session.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _campaign_to_dict(c: Campaign, include_contacts=False, include_results=False) -> Dict:
    pending = c.total - c.sent - c.failed
    d = {
        "id":         c.id,
        "name":       c.name,
        "subject":    c.subject,
        "body":       c.body,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "status":     c.status,
        "stats": {
            "total":   c.total,
            "sent":    c.sent,
            "failed":  c.failed,
            "pending": pending,
        },
    }
    if include_contacts:
        d["contacts"] = [_contact_to_dict(ct) for ct in c.contacts]
    if include_results:
        d["results"] = [_result_to_dict(r) for r in c.results]
    return d


def _contact_to_dict(ct: Contact) -> Dict:
    base = {"name": ct.name, "email": ct.email}
    if ct.extra:
        base.update(ct.extra)
    return base


def _result_to_dict(r: Result) -> Dict:
    return {
        "name":       r.name,
        "email":      r.email,
        "status":     r.status,
        "message_id": r.message_id,
        "error":      r.error,
        "timestamp":  r.timestamp.isoformat() if r.timestamp else None,
    }


# ── Campaign CRUD ─────────────────────────────────────────────────────────────

async def create_campaign(name: str, subject: str, body: str, contacts: List[Dict]) -> Dict:
    async with AsyncSessionLocal() as session:
        cid = str(uuid.uuid4())
        campaign = Campaign(
            id=cid, name=name, subject=subject, body=body,
            total=len(contacts), sent=0, failed=0,
        )
        session.add(campaign)

        for ct in contacts:
            extra = {k: v for k, v in ct.items() if k not in ("name", "email")}
            session.add(Contact(
                campaign_id=cid,
                name=ct["name"],
                email=ct["email"],
                extra=extra or None,
            ))

        await session.commit()
        await session.refresh(campaign)
        # eager-load contacts for the return value
        from sqlalchemy.orm import selectinload
        result = await session.execute(
            select(Campaign).options(selectinload(Campaign.contacts)).where(Campaign.id == cid)
        )
        campaign = result.scalar_one()
        return _campaign_to_dict(campaign, include_contacts=True)


async def get_campaign(campaign_id: str) -> Optional[Dict]:
    from sqlalchemy.orm import selectinload
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Campaign)
            .options(selectinload(Campaign.contacts), selectinload(Campaign.results))
            .where(Campaign.id == campaign_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        return _campaign_to_dict(campaign, include_contacts=True, include_results=True)


async def get_all_campaigns() -> List[Dict]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Campaign).order_by(Campaign.created_at.desc())
        )
        campaigns = result.scalars().all()
        return [_campaign_to_dict(c) for c in campaigns]


async def update_campaign(campaign_id: str, updates: Dict) -> Optional[Dict]:
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(Campaign).where(Campaign.id == campaign_id).values(**updates)
        )
        await session.commit()
    return await get_campaign(campaign_id)


async def add_campaign_result(campaign_id: str, result_data: Dict):
    async with AsyncSessionLocal() as session:
        session.add(Result(
            campaign_id=campaign_id,
            name=result_data.get("name"),
            email=result_data.get("email"),
            status=result_data.get("status"),
            message_id=result_data.get("message_id"),
            error=result_data.get("error"),
            timestamp=datetime.fromisoformat(result_data["timestamp"]) if result_data.get("timestamp") else datetime.utcnow(),
        ))

        # Update aggregate counters in the campaign row
        if result_data.get("status") == "sent":
            await session.execute(
                update(Campaign).where(Campaign.id == campaign_id)
                .values(sent=Campaign.sent + 1)
            )
        else:
            await session.execute(
                update(Campaign).where(Campaign.id == campaign_id)
                .values(failed=Campaign.failed + 1)
            )

        await session.commit()


# ── Settings ──────────────────────────────────────────────────────────────────

async def get_settings() -> Dict:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Setting))).scalars().all()
        settings = {row.key: row.value for row in rows}
        # Cast numeric values back to their proper types
        if "delay_between_emails" in settings:
            settings["delay_between_emails"] = float(settings["delay_between_emails"])
        if "max_retry_count" in settings:
            settings["max_retry_count"] = int(settings["max_retry_count"])
        return settings


async def update_settings(updates: Dict) -> Dict:
    async with AsyncSessionLocal() as session:
        for key, value in updates.items():
            existing = await session.get(Setting, key)
            if existing:
                existing.value = str(value)
            else:
                session.add(Setting(key=key, value=str(value)))
        await session.commit()
    return await get_settings()


# ── Dashboard ─────────────────────────────────────────────────────────────────

async def get_dashboard_stats() -> Dict:
    async with AsyncSessionLocal() as session:
        row = (await session.execute(
            select(
                func.count(Campaign.id).label("total_campaigns"),
                func.coalesce(func.sum(Campaign.total),  0).label("total_contacts"),
                func.coalesce(func.sum(Campaign.sent),   0).label("emails_sent"),
                func.coalesce(func.sum(Campaign.failed), 0).label("failed_emails"),
            )
        )).one()

    total_contacts = int(row.total_contacts)
    emails_sent    = int(row.emails_sent)
    failed_emails  = int(row.failed_emails)
    pending_emails = total_contacts - emails_sent - failed_emails
    success_rate   = round(emails_sent / total_contacts * 100, 1) if total_contacts > 0 else 0.0

    return {
        "total_contacts":  total_contacts,
        "emails_sent":     emails_sent,
        "failed_emails":   failed_emails,
        "pending_emails":  pending_emails,
        "success_rate":    success_rate,
        "total_campaigns": int(row.total_campaigns),
    }
