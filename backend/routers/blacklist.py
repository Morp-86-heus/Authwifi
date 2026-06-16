from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import MacBlacklist, Site
from auth import get_current_manager, can_access_site

router = APIRouter(prefix="/sites/{site_id}/blacklist", tags=["blacklist"])


class MacBlacklistDto(BaseModel):
    mac_address: str
    reason: Optional[str] = None


@router.get("")
def list_blacklist(
    site_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")
    entries = db.query(MacBlacklist).filter(
        MacBlacklist.site_id == site_id,
        MacBlacklist.tenant_id == current["tenant_id"],
    ).all()
    return [{"id": e.id, "macAddress": e.mac_address, "reason": e.reason, "createdAt": e.created_at} for e in entries]


@router.post("", status_code=201)
def add_to_blacklist(
    site_id: str,
    dto: MacBlacklistDto,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")
    site = db.query(Site).filter(
        Site.id == site_id,
        Site.tenant_id == current["tenant_id"],
    ).first()
    if not site:
        raise HTTPException(status_code=404, detail="Sito non trovato")

    mac = dto.mac_address.upper().strip()
    if db.query(MacBlacklist).filter(MacBlacklist.site_id == site_id, MacBlacklist.mac_address == mac).first():
        raise HTTPException(status_code=400, detail="MAC già in blacklist")

    entry = MacBlacklist(tenant_id=site.tenant_id, site_id=site_id, mac_address=mac, reason=dto.reason)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "macAddress": entry.mac_address, "reason": entry.reason, "createdAt": entry.created_at}


@router.delete("/{entry_id}", status_code=204)
def remove_from_blacklist(
    site_id: str,
    entry_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")
    entry = db.query(MacBlacklist).filter(MacBlacklist.id == entry_id, MacBlacklist.site_id == site_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Voce non trovata")
    db.delete(entry)
    db.commit()
