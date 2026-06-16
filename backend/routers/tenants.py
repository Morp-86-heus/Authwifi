from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Tenant
from auth import require_roles

router = APIRouter(prefix="/tenants", tags=["tenants"])


class CreateTenantDto(BaseModel):
    name: str
    slug: str
    contact_email: Optional[str] = None
    logo_url: Optional[str] = None


@router.post("", status_code=201)
def create_tenant(
    dto: CreateTenantDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenant = Tenant(
        name=dto.name,
        slug=dto.slug,
        contact_email=dto.contact_email,
        logo_url=dto.logo_url,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("")
def list_tenants(
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    return db.query(Tenant).filter(Tenant.deleted_at.is_(None)).all()


@router.get("/{tenant_id}")
def get_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("superadmin")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} non trovato")
    return tenant
