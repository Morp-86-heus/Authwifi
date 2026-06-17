"""Automation CRUD."""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models import Automation, Site, new_id
from auth import get_current_manager
from services.email_builder import blocks_to_html

router = APIRouter(prefix="/automations", tags=["automations"])

TRIGGER_TYPES = ("welcome", "anniversary", "inactivity", "survey_done", "segment_enter")


class AutomationIn(BaseModel):
    site_id: Optional[str] = None
    name: str
    subject: str = ""
    blocks: list = []
    trigger_type: str = "welcome"
    trigger_config: dict = {}
    delay_hours: int = 0
    enabled: bool = True


def _automation_dict(a: Automation) -> dict:
    return {
        "id": a.id,
        "siteId": a.site_id,
        "name": a.name,
        "subject": a.subject,
        "blocks": json.loads(a.blocks) if a.blocks else [],
        "triggerType": a.trigger_type,
        "triggerConfig": json.loads(a.trigger_config) if a.trigger_config else {},
        "delayHours": a.delay_hours,
        "enabled": a.enabled,
        "createdAt": a.created_at.isoformat(),
        "updatedAt": a.updated_at.isoformat(),
    }


def _site_branding(db: Session, site_id: str | None) -> dict:
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


@router.get("")
def list_automations(
    site_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    q = db.query(Automation).filter(Automation.tenant_id == current["tenant_id"])
    if site_id:
        q = q.filter(Automation.site_id == site_id)
    items = q.order_by(desc(Automation.created_at)).all()
    return {"items": [_automation_dict(a) for a in items]}


@router.post("", status_code=201)
def create_automation(
    data: AutomationIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if data.trigger_type not in TRIGGER_TYPES:
        raise HTTPException(400, f"trigger_type deve essere uno di {TRIGGER_TYPES}")
    a = Automation(
        id=new_id(),
        tenant_id=current["tenant_id"],
        site_id=data.site_id,
        name=data.name,
        subject=data.subject,
        blocks=json.dumps(data.blocks),
        trigger_type=data.trigger_type,
        trigger_config=json.dumps(data.trigger_config),
        delay_hours=data.delay_hours,
        enabled=data.enabled,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _automation_dict(a)


@router.get("/{automation_id}")
def get_automation(
    automation_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    a = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.tenant_id == current["tenant_id"],
    ).first()
    if not a:
        raise HTTPException(404, "Automation not found")
    return _automation_dict(a)


@router.patch("/{automation_id}")
def update_automation(
    automation_id: str,
    data: AutomationIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    a = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.tenant_id == current["tenant_id"],
    ).first()
    if not a:
        raise HTTPException(404, "Automation not found")
    if data.trigger_type not in TRIGGER_TYPES:
        raise HTTPException(400, f"trigger_type deve essere uno di {TRIGGER_TYPES}")
    a.site_id = data.site_id
    a.name = data.name
    a.subject = data.subject
    a.blocks = json.dumps(data.blocks)
    a.trigger_type = data.trigger_type
    a.trigger_config = json.dumps(data.trigger_config)
    a.delay_hours = data.delay_hours
    a.enabled = data.enabled
    a.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(a)
    return _automation_dict(a)


@router.delete("/{automation_id}", status_code=204)
def delete_automation(
    automation_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    a = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.tenant_id == current["tenant_id"],
    ).first()
    if not a:
        raise HTTPException(404, "Automation not found")
    db.delete(a)
    db.commit()


@router.post("/{automation_id}/preview", response_class=HTMLResponse)
def preview_automation(
    automation_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    a = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.tenant_id == current["tenant_id"],
    ).first()
    if not a:
        raise HTTPException(404, "Automation not found")
    branding = _site_branding(db, a.site_id)
    blocks = json.loads(a.blocks) if a.blocks else []
    html_content = blocks_to_html(
        blocks,
        logo_url=branding["logo_url"],
        primary_color=branding["primary_color"],
        site_name=branding["site_name"],
        footer_text=branding["footer_text"],
    )
    return HTMLResponse(content=html_content)
