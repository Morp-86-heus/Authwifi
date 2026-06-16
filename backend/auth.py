import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import Tenant

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET environment variable must be set to a random string "
        "of at least 32 characters."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(manager_id: str, tenant_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": manager_id, "tenantId": tenant_id, "role": role, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_manager(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = payload.get("role", "owner")
    manager_id = payload["sub"]
    tenant_id = payload["tenantId"]

    if role != "superadmin":
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant or tenant.deleted_at:
            raise HTTPException(status_code=403, detail="Tenant non trovato")
        if tenant.is_suspended:
            raise HTTPException(status_code=403, detail="Account sospeso")
        if tenant.plan_expires_at and tenant.plan_expires_at < datetime.utcnow():
            raise HTTPException(status_code=403, detail="Licenza scaduta")

    if role in ("superadmin", "owner"):
        site_ids = None  # accesso illimitato
    else:
        from models import ManagerSite
        assignments = db.query(ManagerSite).filter(
            ManagerSite.manager_id == manager_id
        ).all()
        site_ids = [a.site_id for a in assignments]

    return {
        "manager_id": manager_id,
        "tenant_id": tenant_id,
        "role": role,
        "site_ids": site_ids,  # None = tutti i siti, list = siti assegnati
    }


def require_roles(*roles: str):
    def _check(current: dict = Depends(get_current_manager)):
        if current["role"] not in roles:
            raise HTTPException(status_code=403, detail="Accesso non autorizzato")
        return current
    return _check


def can_access_site(site_id: str, current: dict) -> bool:
    if current["role"] in ("superadmin", "owner"):
        return True
    return site_id in (current["site_ids"] or [])
