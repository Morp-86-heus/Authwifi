from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from typing import Optional
from datetime import datetime, timedelta, timezone
from database import get_db
from models import Tenant, Manager, Site, ManagerRole, ManagerSite
from auth import require_roles, hash_password

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


class TenantAnagraficaFields(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: Optional[str] = None
    slug: Optional[str] = None
    plan: Optional[str] = None
    # Anagrafica
    ragione_sociale: Optional[str] = None
    forma_giuridica: Optional[str] = None
    partita_iva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    # Sede
    via: Optional[str] = None
    civico: Optional[str] = None
    cap: Optional[str] = None
    citta: Optional[str] = None
    provincia: Optional[str] = None
    paese: Optional[str] = None
    # Contatti
    telefono: Optional[str] = None
    contact_email: Optional[str] = None
    pec: Optional[str] = None
    sito_web: Optional[str] = None
    # Fatturazione
    codice_sdi: Optional[str] = None
    pec_fatturazione: Optional[str] = None
    iban: Optional[str] = None
    note: Optional[str] = None
    # Licenza
    plan_expires_at: Optional[datetime] = None
    is_suspended: Optional[bool] = None


class CreateTenantDto(TenantAnagraficaFields):
    name: str
    slug: str
    plan: str = "TRIAL"
    owner_email: Optional[str] = None
    owner_password: Optional[str] = None
    owner_first_name: Optional[str] = None
    owner_last_name: Optional[str] = None


class UpdateTenantDto(TenantAnagraficaFields):
    pass


class CreateSiteDto(BaseModel):
    name: str
    address: Optional[str] = None
    type: str = "HOTEL"


class CreateManagerForTenantDto(BaseModel):
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "manager"
    site_ids: Optional[list[str]] = None


def _license_status(t: Tenant) -> str:
    if t.is_suspended:
        return "sospeso"
    if t.plan_expires_at is None:
        return "attivo"
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if t.plan_expires_at < now:
        return "scaduto"
    if t.plan_expires_at < now + timedelta(days=7):
        return "in_scadenza"
    return "attivo"


def _tenant_out(t: Tenant, db: Session) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "plan": t.plan,
        "ragioneSociale": t.ragione_sociale,
        "formaGiuridica": t.forma_giuridica,
        "partitaIva": t.partita_iva,
        "codiceFiscale": t.codice_fiscale,
        "via": t.via,
        "civico": t.civico,
        "cap": t.cap,
        "citta": t.citta,
        "provincia": t.provincia,
        "paese": t.paese,
        "telefono": t.telefono,
        "contactEmail": t.contact_email,
        "pec": t.pec,
        "sitoWeb": t.sito_web,
        "codiceSdi": t.codice_sdi,
        "pecFatturazione": t.pec_fatturazione,
        "iban": t.iban,
        "note": t.note,
        "siteCount": db.query(func.count(Site.id)).filter(Site.tenant_id == t.id).scalar(),
        "managerCount": db.query(func.count(Manager.id)).filter(Manager.tenant_id == t.id).scalar(),
        "planExpiresAt": t.plan_expires_at,
        "isSuspended": t.is_suspended,
        "licenseStatus": _license_status(t),
        "daysRemaining": max(0, (t.plan_expires_at - datetime.now(timezone.utc).replace(tzinfo=None)).days) if t.plan_expires_at else None,
        "createdAt": t.created_at,
    }


@router.get("/tenants")
def list_tenants(
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenants = db.query(Tenant).filter(Tenant.deleted_at.is_(None)).all()
    return [_tenant_out(t, db) for t in tenants]


@router.post("/tenants", status_code=201)
def create_tenant(
    dto: CreateTenantDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    if db.query(Tenant).filter(Tenant.slug == dto.slug).first():
        raise HTTPException(status_code=400, detail="Slug già in uso")

    anagrafica = dto.model_dump(exclude_none=True, exclude={
        "owner_email", "owner_password", "owner_first_name", "owner_last_name"
    })
    if "plan_expires_at" not in anagrafica and anagrafica.get("plan", "TRIAL") == "TRIAL":
        anagrafica["plan_expires_at"] = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
    tenant = Tenant(**anagrafica)
    db.add(tenant)
    db.flush()

    owner_email = None
    if dto.owner_email and dto.owner_password:
        if db.query(Manager).filter(Manager.email == dto.owner_email).first():
            raise HTTPException(status_code=400, detail="Email owner già in uso")
        owner = Manager(
            tenant_id=tenant.id,
            email=dto.owner_email,
            password_hash=hash_password(dto.owner_password),
            first_name=dto.owner_first_name,
            last_name=dto.owner_last_name,
            role=ManagerRole.OWNER,
        )
        db.add(owner)
        owner_email = dto.owner_email

    db.commit()
    db.refresh(tenant)
    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "plan": tenant.plan,
        "siteCount": 0,
        "managerCount": 1 if owner_email else 0,
        "createdAt": tenant.created_at,
        "ownerEmail": owner_email,
    }


@router.patch("/tenants/{tenant_id}")
def update_tenant(
    tenant_id: str,
    dto: UpdateTenantDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trovato")
    if dto.slug and dto.slug != tenant.slug:
        if db.query(Tenant).filter(Tenant.slug == dto.slug).first():
            raise HTTPException(status_code=400, detail="Slug già in uso")
    for field, value in dto.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)
    db.commit()
    db.refresh(tenant)
    return _tenant_out(tenant, db)


@router.get("/tenants/{tenant_id}")
def get_tenant_detail(
    tenant_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trovato")

    sites = db.query(Site).filter(Site.tenant_id == tenant_id).all()
    managers = db.query(Manager).filter(Manager.tenant_id == tenant_id).all()

    out = _tenant_out(tenant, db)
    out["sites"] = [
        {"id": s.id, "name": s.name, "type": s.type, "address": s.address, "createdAt": s.created_at}
        for s in sites
    ]
    out["managers"] = [
        {"id": m.id, "email": m.email, "role": m.role, "firstName": m.first_name, "lastName": m.last_name}
        for m in managers
    ]
    return out


@router.post("/tenants/{tenant_id}/sites", status_code=201)
def create_site_for_tenant(
    tenant_id: str,
    dto: CreateSiteDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant non trovato")

    site = Site(tenant_id=tenant_id, name=dto.name, address=dto.address, type=dto.type)
    db.add(site)
    db.commit()
    db.refresh(site)
    return {"id": site.id, "name": site.name, "type": site.type, "address": site.address, "createdAt": site.created_at}


@router.post("/tenants/{tenant_id}/managers", status_code=201)
def create_manager_for_tenant(
    tenant_id: str,
    dto: CreateManagerForTenantDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant non trovato")
    if db.query(Manager).filter(Manager.email == dto.email).first():
        raise HTTPException(status_code=400, detail="Email già in uso")
    try:
        role = ManagerRole(dto.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Ruolo non valido: {dto.role}")

    manager = Manager(
        tenant_id=tenant_id,
        email=dto.email,
        password_hash=hash_password(dto.password),
        first_name=dto.first_name,
        last_name=dto.last_name,
        role=role,
    )
    db.add(manager)
    db.flush()

    if dto.site_ids and dto.role in ("manager", "staff"):
        for sid in dto.site_ids:
            db.add(ManagerSite(manager_id=manager.id, site_id=sid))

    db.commit()
    db.refresh(manager)
    return {
        "id": manager.id, "email": manager.email, "role": manager.role,
        "firstName": manager.first_name, "lastName": manager.last_name,
    }


@router.delete("/tenants/{tenant_id}/managers/{manager_id}", status_code=204)
def delete_manager_from_tenant(
    tenant_id: str,
    manager_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    manager = db.query(Manager).filter(
        Manager.id == manager_id, Manager.tenant_id == tenant_id
    ).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    db.delete(manager)
    db.commit()


@router.post("/tenants/{tenant_id}/suspend")
def suspend_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trovato")
    tenant.is_suspended = True
    db.commit()
    db.refresh(tenant)
    return _tenant_out(tenant, db)


@router.post("/tenants/{tenant_id}/unsuspend")
def unsuspend_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trovato")
    tenant.is_suspended = False
    db.commit()
    db.refresh(tenant)
    return _tenant_out(tenant, db)


@router.delete("/tenants/{tenant_id}", status_code=204)
def delete_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trovato")
    tenant.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
