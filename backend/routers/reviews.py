import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_manager, require_roles, can_access_site
from database import get_db
from models import ExternalReview, Site
from services.google_places import fetch_google_reviews, PLACES_API_KEY

router = APIRouter(prefix="/reviews", tags=["reviews"])
logger = logging.getLogger(__name__)


@router.get("")
def list_reviews(
    site_id: Optional[str] = Query(default=None),
    source: str = Query(default="google"),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    q = db.query(ExternalReview).filter(
        ExternalReview.tenant_id == current["tenant_id"],
        ExternalReview.source == source,
    )
    if site_id:
        q = q.filter(ExternalReview.site_id == site_id)
    if current["site_ids"] is not None:
        q = q.filter(ExternalReview.site_id.in_(current["site_ids"]))

    rows = q.order_by(ExternalReview.published_at.desc()).limit(50).all()

    # avg rating
    ratings = [r.rating for r in rows if r.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None
    last_sync = max((r.fetched_at for r in rows), default=None)

    return {
        "avgRating": avg_rating,
        "total": len(rows),
        "lastSync": last_sync.isoformat() if last_sync else None,
        "hasApiKey": bool(PLACES_API_KEY),
        "items": [
            {
                "id": r.id,
                "authorName": r.author_name,
                "authorPhoto": r.author_photo,
                "rating": r.rating,
                "text": r.text,
                "publishedAt": r.published_at.isoformat() if r.published_at else None,
                "siteId": r.site_id,
            }
            for r in rows
        ],
    }


@router.post("/sync")
def sync_reviews(
    site_id: str = Query(...),
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner", "manager", "superadmin")),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")

    if not PLACES_API_KEY:
        raise HTTPException(
            status_code=422,
            detail="GOOGLE_PLACES_API_KEY non configurata. Aggiungila al file .env del server.",
        )

    q = db.query(Site).filter(Site.id == site_id)
    if current["role"] != "superadmin":
        q = q.filter(Site.tenant_id == current["tenant_id"])
    site = q.first()
    if not site:
        raise HTTPException(status_code=404, detail="Sito non trovato")

    if not site.google_place_id:
        raise HTTPException(
            status_code=422,
            detail="Google Place ID non configurato per questo sito. Vai in Impostazioni → Survey.",
        )

    reviews = fetch_google_reviews(site.google_place_id)
    if reviews is None:
        raise HTTPException(status_code=502, detail="Errore nella chiamata a Google Places API.")

    synced = 0
    for rev in reviews:
        existing = db.query(ExternalReview).filter(
            ExternalReview.site_id == site_id,
            ExternalReview.source == "google",
            ExternalReview.external_id == rev["external_id"],
        ).first()

        if existing:
            existing.rating = rev["rating"]
            existing.text = rev["text"]
            existing.fetched_at = datetime.utcnow()
        else:
            db.add(ExternalReview(
                site_id=site_id,
                tenant_id=current["tenant_id"],
                source="google",
                external_id=rev["external_id"],
                author_name=rev["author_name"],
                author_photo=rev["author_photo"],
                rating=rev["rating"],
                text=rev["text"],
                published_at=rev["published_at"],
            ))
            synced += 1

    db.commit()
    logger.info("Sync Google reviews per sito %s: %d nuove, %d aggiornate", site_id, synced, len(reviews) - synced)
    return {"synced": synced, "total": len(reviews)}
