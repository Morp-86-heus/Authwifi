"""Campaign CRUD, preview, send-now, schedule."""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import get_db
from models import (
    Campaign, CampaignRecipient, Guest, Site, Segment, SubSegment, WifiSession,
    new_id
)
from auth import get_current_manager
from services.email_builder import blocks_to_html

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CampaignIn(BaseModel):
    site_id: Optional[str] = None
    name: str
    subject: str = ""
    blocks: list = []
    audience_type: str = "all"       # all | segment | sub_segment | marketing_consent
    audience_segment_id: Optional[str] = None
    audience_sub_segment_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class CampaignSendNow(BaseModel):
    site_id: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _site_branding(db: Session, site_id: str | None, tenant_id: str) -> dict:
    if site_id:
        site = db.query(Site).filter(Site.id == site_id).first()
        if site:
            return {
                "logo_url": site.logo_url,
                "primary_color": site.primary_color or "#0055ff",
                "site_name": site.name,
                "footer_text": site.smtp_from_name or site.name or "",
            }
    return {"logo_url": None, "primary_color": "#0055ff", "site_name": "", "footer_text": ""}


def _collect_recipients(
    db: Session,
    tenant_id: str,
    site_id: str | None,
    audience_type: str,
    segment_id: str | None,
    sub_segment_id: str | None,
) -> list[tuple[str | None, str]]:  # (guest_id, email)
    q = db.query(Guest).filter(
        Guest.tenant_id == tenant_id,
        Guest.deleted_at.is_(None),
        Guest.email.isnot(None),
    )
    if site_id:
        allowed_ids = (
            db.query(WifiSession.guest_id)
            .filter(WifiSession.site_id == site_id)
            .distinct()
        )
        q = q.filter(Guest.id.in_(allowed_ids))

    if audience_type == "marketing_consent":
        from models import Consent, ConsentType
        consented = (
            db.query(Consent.guest_id)
            .filter(
                Consent.type == ConsentType.MARKETING_EMAIL,
                Consent.granted == True,
            )
            .distinct()
        )
        q = q.filter(Guest.id.in_(consented))
    elif audience_type == "segment" and segment_id:
        q = q.filter(Guest.segment_id == segment_id)
    elif audience_type == "sub_segment" and sub_segment_id:
        q = q.filter(Guest.sub_segment_id == sub_segment_id)

    return [(g.id, g.email) for g in q.all() if g.email]


def _campaign_dict(c: Campaign) -> dict:
    return {
        "id": c.id,
        "siteId": c.site_id,
        "name": c.name,
        "subject": c.subject,
        "blocks": json.loads(c.blocks) if c.blocks else [],
        "status": c.status,
        "audienceType": c.audience_type,
        "audienceSegmentId": c.audience_segment_id,
        "audienceSubSegmentId": c.audience_sub_segment_id,
        "totalRecipients": c.total_recipients,
        "sentCount": c.sent_count,
        "failedCount": c.failed_count,
        "scheduledAt": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "sentAt": c.sent_at.isoformat() if c.sent_at else None,
        "createdAt": c.created_at.isoformat(),
        "updatedAt": c.updated_at.isoformat(),
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def list_campaigns(
    site_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    tenant_id = current["tenant_id"]
    q = db.query(Campaign).filter(Campaign.tenant_id == tenant_id)
    if site_id:
        q = q.filter(Campaign.site_id == site_id)
    total = q.count()
    items = q.order_by(desc(Campaign.created_at)).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_campaign_dict(c) for c in items]}


@router.post("", status_code=201)
def create_campaign(
    data: CampaignIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    tenant_id = current["tenant_id"]
    c = Campaign(
        id=new_id(),
        tenant_id=tenant_id,
        site_id=data.site_id,
        name=data.name,
        subject=data.subject,
        blocks=json.dumps(data.blocks),
        status="draft",
        audience_type=data.audience_type,
        audience_segment_id=data.audience_segment_id,
        audience_sub_segment_id=data.audience_sub_segment_id,
        scheduled_at=data.scheduled_at,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _campaign_dict(c)


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    c = db.query(Campaign).filter(
        Campaign.id == campaign_id, Campaign.tenant_id == current["tenant_id"]
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    return _campaign_dict(c)


@router.patch("/{campaign_id}")
def update_campaign(
    campaign_id: str,
    data: CampaignIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    c = db.query(Campaign).filter(
        Campaign.id == campaign_id, Campaign.tenant_id == current["tenant_id"]
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status == "sending":
        raise HTTPException(400, "Campagna in invio, impossibile modificare")
    # Se già inviata/annullata, riporta a bozza al salvataggio
    if c.status in ("sent", "cancelled"):
        c.status = "draft"
    c.site_id = data.site_id
    c.name = data.name
    c.subject = data.subject
    c.blocks = json.dumps(data.blocks)
    c.audience_type = data.audience_type
    c.audience_segment_id = data.audience_segment_id
    c.audience_sub_segment_id = data.audience_sub_segment_id
    c.scheduled_at = data.scheduled_at
    c.status = "scheduled" if data.scheduled_at else "draft"
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return _campaign_dict(c)


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    c = db.query(Campaign).filter(
        Campaign.id == campaign_id, Campaign.tenant_id == current["tenant_id"]
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status in ("sending",):
        raise HTTPException(400, "Campagna in invio, impossibile eliminare")
    db.delete(c)
    db.commit()


@router.post("/{campaign_id}/preview", response_class=HTMLResponse)
def preview_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    c = db.query(Campaign).filter(
        Campaign.id == campaign_id, Campaign.tenant_id == current["tenant_id"]
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    branding = _site_branding(db, c.site_id, current["tenant_id"])
    blocks = json.loads(c.blocks) if c.blocks else []
    html = blocks_to_html(
        blocks,
        logo_url=branding["logo_url"],
        primary_color=branding["primary_color"],
        site_name=branding["site_name"],
        footer_text=branding["footer_text"],
    )
    return HTMLResponse(content=html)


@router.post("/{campaign_id}/send-now", status_code=202)
def send_now(
    campaign_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    c = db.query(Campaign).filter(
        Campaign.id == campaign_id, Campaign.tenant_id == current["tenant_id"]
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status == "sending":
        raise HTTPException(400, "Campagna già in invio, attendi il completamento")

    recipients = _collect_recipients(
        db, current["tenant_id"], c.site_id,
        c.audience_type, c.audience_segment_id, c.audience_sub_segment_id,
    )
    if not recipients:
        raise HTTPException(400, "Nessun destinatario trovato")

    # Crea recipient records + imposta stato
    db.query(CampaignRecipient).filter(
        CampaignRecipient.campaign_id == campaign_id
    ).delete()

    for (gid, email) in recipients:
        db.add(CampaignRecipient(
            id=new_id(),
            campaign_id=campaign_id,
            guest_id=gid,
            email=email,
            status="pending",
        ))

    c.status = "sending"
    c.total_recipients = len(recipients)
    c.sent_count = 0
    c.failed_count = 0
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"queued": len(recipients)}


@router.get("/{campaign_id}/stats")
def campaign_stats(
    campaign_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    c = db.query(Campaign).filter(
        Campaign.id == campaign_id, Campaign.tenant_id == current["tenant_id"]
    ).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    pending = db.query(func.count(CampaignRecipient.id)).filter(
        CampaignRecipient.campaign_id == campaign_id,
        CampaignRecipient.status == "pending",
    ).scalar()
    return {
        "total": c.total_recipients,
        "sent": c.sent_count,
        "failed": c.failed_count,
        "pending": pending,
        "status": c.status,
    }
