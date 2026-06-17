from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import MacWhitelist, Site
from auth import get_current_manager, can_access_site

router = APIRouter(prefix="/sites/{site_id}/whitelist", tags=["whitelist"])


class MacWhitelistDto(BaseModel):
    mac_address: str
    label: Optional[str] = None


@router.get("")
def list_whitelist(
    site_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")
    entries = db.query(MacWhitelist).filter(
        MacWhitelist.site_id == site_id,
        MacWhitelist.tenant_id == current["tenant_id"],
    ).all()
    return [{"id": e.id, "macAddress": e.mac_address, "label": e.label, "createdAt": e.created_at} for e in entries]


@router.post("", status_code=201)
def add_to_whitelist(
    site_id: str,
    dto: MacWhitelistDto,
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
    existing = db.query(MacWhitelist).filter(
        MacWhitelist.site_id == site_id,
        MacWhitelist.mac_address == mac,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="MAC già in whitelist")

    entry = MacWhitelist(
        tenant_id=site.tenant_id,
        site_id=site_id,
        mac_address=mac,
        label=dto.label,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    from services.cache import cache_delete
    cache_delete(f"whitelist_macs:{site_id}")
    return {"id": entry.id, "macAddress": entry.mac_address, "label": entry.label, "createdAt": entry.created_at}


@router.delete("/{entry_id}", status_code=204)
def remove_from_whitelist(
    site_id: str,
    entry_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")
    entry = db.query(MacWhitelist).filter(
        MacWhitelist.id == entry_id,
        MacWhitelist.site_id == site_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Voce non trovata")
    db.delete(entry)
    db.commit()
    from services.cache import cache_delete
    cache_delete(f"whitelist_macs:{site_id}")
