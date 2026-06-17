import uuid
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from typing import Optional
from database import get_db
from models import Site
from auth import get_current_manager, require_roles, can_access_site

router = APIRouter(prefix="/sites", tags=["sites"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
FIELD_MAP = {
    "logo": "logo_url",
    "background": "background_image_url",
    "hero": "hero_image_url",
}


class SiteOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: str
    name: str
    address: Optional[str] = None
    type: str
    primary_color: str
    accent_color: str
    welcome_title: str
    welcome_text: str
    login_methods: str
    logo_url: Optional[str] = None
    background_image_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    omada_controller_url: Optional[str] = None
    omada_omadac_id: Optional[str] = None
    omada_site_id: Optional[str] = None
    omada_operator_user: Optional[str] = None
    omada_operator_pass: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tripadvisor_url: Optional[str] = None
    google_review_url: Optional[str] = None
    booking_url: Optional[str] = None
    twitter_url: Optional[str] = None
    survey_enabled: bool = True
    survey_hours_delay: int = 24
    google_place_id: Optional[str] = None
    survey_title: Optional[str] = None
    survey_subtitle: Optional[str] = None
    survey_question_label: Optional[str] = None
    survey_comment_label: Optional[str] = None
    survey_button_text: Optional[str] = None
    survey_thank_you_title: Optional[str] = None
    survey_show_comment: bool = True
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_security: str = "starttls"
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


def _out(site: Site) -> dict:
    return SiteOut.model_validate(site).model_dump(by_alias=True)


class CreateSiteDto(BaseModel):
    tenant_id: str
    name: str
    address: Optional[str] = None
    omada_controller_url: Optional[str] = None
    omada_omadac_id: Optional[str] = None
    omada_site_id: Optional[str] = None
    omada_operator_user: Optional[str] = None
    omada_operator_pass: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    welcome_title: Optional[str] = None
    welcome_text: Optional[str] = None
    login_methods: Optional[str] = None


class UpdateSiteDto(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: Optional[str] = None
    address: Optional[str] = None
    omada_controller_url: Optional[str] = None
    omada_omadac_id: Optional[str] = None
    omada_site_id: Optional[str] = None
    omada_operator_user: Optional[str] = None
    omada_operator_pass: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    welcome_title: Optional[str] = None
    welcome_text: Optional[str] = None
    login_methods: Optional[str] = None
    logo_url: Optional[str] = None
    background_image_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tripadvisor_url: Optional[str] = None
    google_review_url: Optional[str] = None
    booking_url: Optional[str] = None
    twitter_url: Optional[str] = None
    survey_enabled: Optional[bool] = None
    survey_hours_delay: Optional[int] = None
    google_place_id: Optional[str] = None
    survey_title: Optional[str] = None
    survey_subtitle: Optional[str] = None
    survey_question_label: Optional[str] = None
    survey_comment_label: Optional[str] = None
    survey_button_text: Optional[str] = None
    survey_thank_you_title: Optional[str] = None
    survey_show_comment: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_security: Optional[str] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None


@router.post("", status_code=201)
def create_site(
    dto: CreateSiteDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner", "superadmin")),
):
    data = dto.model_dump(exclude_none=True)
    if current["role"] == "owner":
        data["tenant_id"] = current["tenant_id"]
    elif "tenant_id" not in data:
        raise HTTPException(status_code=400, detail="tenant_id richiesto per superadmin")
    site = Site(**data)
    db.add(site)
    db.commit()
    db.refresh(site)
    return _out(site)


@router.get("")
def list_sites(
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    query = db.query(Site).filter(Site.tenant_id == current["tenant_id"])
    if current["site_ids"] is not None:
        query = query.filter(Site.id.in_(current["site_ids"]))
    return [_out(s) for s in query.all()]


@router.get("/{site_id}")
def get_site(
    site_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato a questo sito")
    q = db.query(Site).filter(Site.id == site_id)
    if current["role"] != "superadmin":
        q = q.filter(Site.tenant_id == current["tenant_id"])
    site = q.first()
    if not site:
        raise HTTPException(status_code=404, detail="Sito non trovato")
    return _out(site)


@router.patch("/{site_id}")
def update_site(
    site_id: str,
    dto: UpdateSiteDto,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner", "manager", "superadmin")),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato a questo sito")
    q = db.query(Site).filter(Site.id == site_id)
    if current["role"] != "superadmin":
        q = q.filter(Site.tenant_id == current["tenant_id"])
    site = q.first()
    if not site:
        raise HTTPException(status_code=404, detail="Sito non trovato")
    for key, val in dto.model_dump(exclude_none=True).items():
        setattr(site, key, val)
    db.commit()
    db.refresh(site)
    return _out(site)


@router.post("/{site_id}/upload/{field}")
async def upload_image(
    site_id: str,
    field: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato a questo sito")
    if field not in FIELD_MAP:
        raise HTTPException(status_code=400, detail="Campo non valido. Usa: logo, background, hero")
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa JPEG, PNG, WebP o SVG")

    uploads_dir = Path("public/uploads")
    uploads_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{site_id}-{field}-{uuid.uuid4()}{ext}"
    content = await file.read()
    (uploads_dir / filename).write_bytes(content)

    public_url = f"/public/uploads/{filename}"
    q = db.query(Site).filter(Site.id == site_id)
    if current["role"] != "superadmin":
        q = q.filter(Site.tenant_id == current["tenant_id"])
    site = q.first()
    if not site:
        raise HTTPException(status_code=404, detail="Sito non trovato")

    setattr(site, FIELD_MAP[field], public_url)
    db.commit()
    return {"url": public_url}
