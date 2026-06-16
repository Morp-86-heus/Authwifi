from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models import Manager, ManagerSite, Site
from auth import get_current_manager, hash_password, require_roles

router = APIRouter(prefix="/managers", tags=["managers"])

EDITABLE_ROLES = ("manager", "staff")


class CreateManagerDto(BaseModel):
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "manager"
    site_ids: Optional[List[str]] = None


class UpdateManagerDto(BaseModel):
    role: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    site_ids: Optional[List[str]] = None


def _serialize(m: Manager, db: Session) -> dict:
    assignments = db.query(ManagerSite).filter(ManagerSite.manager_id == m.id).all()
    return {
        "id": m.id,
        "email": m.email,
        "firstName": m.first_name,
        "lastName": m.last_name,
        "role": m.role,
        "siteIds": [a.site_id for a in assignments],
        "createdAt": m.created_at,
    }


@router.get("")
def list_managers(
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner", "superadmin")),
):
    managers = (
        db.query(Manager)
        .filter(Manager.tenant_id == current["tenant_id"])
        .all()
    )
    return [_serialize(m, db) for m in managers]


@router.post("", status_code=201)
def create_manager(
    dto: CreateManagerDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner", "superadmin")),
):
    if dto.role not in EDITABLE_ROLES:
        raise HTTPException(status_code=400, detail="Ruolo non valido. Usa: manager, staff")
    if db.query(Manager).filter(Manager.email == dto.email).first():
        raise HTTPException(status_code=400, detail="Email già registrata")

    manager = Manager(
        tenant_id=current["tenant_id"],
        email=dto.email,
        password_hash=hash_password(dto.password),
        first_name=dto.first_name,
        last_name=dto.last_name,
        role=dto.role,
    )
    db.add(manager)
    db.flush()

    if dto.site_ids:
        valid_ids = {
            s.id for s in db.query(Site.id).filter(
                Site.id.in_(dto.site_ids),
                Site.tenant_id == current["tenant_id"],
            ).all()
        }
        invalid = [sid for sid in dto.site_ids if sid not in valid_ids]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Siti non trovati: {', '.join(invalid)}")
        for sid in dto.site_ids:
            db.add(ManagerSite(manager_id=manager.id, site_id=sid))

    db.commit()
    db.refresh(manager)
    return _serialize(manager, db)


@router.patch("/{manager_id}")
def update_manager(
    manager_id: str,
    dto: UpdateManagerDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner", "superadmin")),
):
    manager = db.query(Manager).filter(
        Manager.id == manager_id,
        Manager.tenant_id == current["tenant_id"],
    ).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trovato")
    if manager.role == "owner" and current["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Non puoi modificare un owner")

    if dto.role is not None:
        if dto.role not in EDITABLE_ROLES:
            raise HTTPException(status_code=400, detail="Ruolo non valido")
        manager.role = dto.role
    if dto.first_name is not None:
        manager.first_name = dto.first_name
    if dto.last_name is not None:
        manager.last_name = dto.last_name

    if dto.site_ids is not None:
        db.query(ManagerSite).filter(ManagerSite.manager_id == manager.id).delete()
        if dto.site_ids:
            valid_ids = {
                s.id for s in db.query(Site.id).filter(
                    Site.id.in_(dto.site_ids),
                    Site.tenant_id == current["tenant_id"],
                ).all()
            }
            invalid = [sid for sid in dto.site_ids if sid not in valid_ids]
            if invalid:
                raise HTTPException(status_code=400, detail=f"Siti non trovati: {', '.join(invalid)}")
            for sid in dto.site_ids:
                db.add(ManagerSite(manager_id=manager.id, site_id=sid))

    db.commit()
    db.refresh(manager)
    return _serialize(manager, db)


@router.delete("/{manager_id}", status_code=204)
def delete_manager(
    manager_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner", "superadmin")),
):
    if manager_id == current["manager_id"]:
        raise HTTPException(status_code=400, detail="Non puoi eliminare te stesso")
    manager = db.query(Manager).filter(
        Manager.id == manager_id,
        Manager.tenant_id == current["tenant_id"],
    ).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trovato")
    if manager.role == "owner" and current["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Non puoi eliminare un owner")
    db.delete(manager)
    db.commit()
