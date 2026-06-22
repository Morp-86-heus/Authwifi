from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Manager, Tenant, ManagerRole
from auth import hash_password, verify_password, create_access_token, get_current_manager as get_current_manager_dep

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginDto(BaseModel):
    email: str
    password: str


class SetupDto(BaseModel):
    email: str
    password: str
    first_name: Optional[str] = None
    tenant_name: str
    tenant_slug: str


@router.post("/login")
def login(dto: LoginDto, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    manager = db.query(Manager).filter(Manager.email == dto.email).first()
    if not manager or not verify_password(dto.password, manager.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenziali non valide",
        )
    if manager.role != ManagerRole.SUPERADMIN:
        tenant = db.query(Tenant).filter(Tenant.id == manager.tenant_id).first()
        if tenant and tenant.is_suspended:
            raise HTTPException(status_code=403, detail="Account sospeso. Contatta il supporto.")
        if tenant and tenant.plan_expires_at and tenant.plan_expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            raise HTTPException(status_code=403, detail="Licenza scaduta. Rinnova il tuo abbonamento.")
    token = create_access_token(manager.id, manager.tenant_id, manager.role)
    return {"accessToken": token, "role": manager.role, "tenantId": manager.tenant_id}


@router.get("/me")
def get_me(db: Session = Depends(get_db), current: dict = Depends(get_current_manager_dep)):
    from models import Manager as Mgr
    m = db.query(Mgr).filter(Mgr.id == current["manager_id"]).first()
    if not m:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return {
        "id": m.id,
        "email": m.email,
        "firstName": m.first_name,
        "lastName": m.last_name,
        "role": m.role,
    }


class UpdateProfileDto(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@router.patch("/me")
def update_me(dto: UpdateProfileDto, db: Session = Depends(get_db), current: dict = Depends(get_current_manager_dep)):
    from models import Manager as Mgr
    m = db.query(Mgr).filter(Mgr.id == current["manager_id"]).first()
    if not m:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if dto.first_name is not None:
        m.first_name = dto.first_name or None
    if dto.last_name is not None:
        m.last_name = dto.last_name or None
    if dto.new_password:
        if not dto.current_password or not verify_password(dto.current_password, m.password_hash):
            raise HTTPException(status_code=400, detail="Password attuale non corretta")
        m.password_hash = hash_password(dto.new_password)
    db.commit()
    return {
        "id": m.id,
        "email": m.email,
        "firstName": m.first_name,
        "lastName": m.last_name,
        "role": m.role,
    }


@router.post("/setup", status_code=201)
def setup(dto: SetupDto, db: Session = Depends(get_db)):
    """Crea tenant + primo owner. Usare solo su DB vuoto."""
    if db.query(Manager).count() > 0:
        raise HTTPException(status_code=400, detail="Setup già completato")
    tenant = Tenant(name=dto.tenant_name, slug=dto.tenant_slug)
    db.add(tenant)
    db.flush()
    manager = Manager(
        tenant_id=tenant.id,
        email=dto.email,
        password_hash=hash_password(dto.password),
        first_name=dto.first_name,
        role=ManagerRole.OWNER,
    )
    db.add(manager)
    db.commit()
    db.refresh(manager)
    token = create_access_token(manager.id, tenant.id, manager.role)
    return {"accessToken": token, "role": manager.role, "tenantId": tenant.id}
