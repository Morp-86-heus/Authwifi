from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, cast, Date
from database import get_db
from models import Guest, WifiSession
from auth import get_current_manager, can_access_site
from services.cache import cache_get, cache_set

router = APIRouter(prefix="/stats", tags=["stats"])

_TTL_STATS = 300  # 5 minuti


@router.get("/{site_id}")
def get_site_stats(
    site_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    if not can_access_site(site_id, current):
        raise HTTPException(status_code=403, detail="Accesso non autorizzato a questo sito")

    cache_key = f"stats:{site_id}:{current['tenant_id']}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    tenant_id = current["tenant_id"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_of_day  = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_week = now - timedelta(days=7)
    start_30d     = now - timedelta(days=30)

    total_guests = (
        db.query(func.count(Guest.id))
        .filter(Guest.tenant_id == tenant_id, Guest.deleted_at.is_(None))
        .scalar()
    )
    new_guests_this_week = (
        db.query(func.count(Guest.id))
        .filter(Guest.tenant_id == tenant_id, Guest.deleted_at.is_(None), Guest.created_at >= start_of_week)
        .scalar()
    )
    connections_today = (
        db.query(func.count(WifiSession.id))
        .filter(WifiSession.site_id == site_id, WifiSession.started_at >= start_of_day)
        .scalar()
    )
    emails_collected = (
        db.query(func.count(Guest.id))
        .filter(Guest.tenant_id == tenant_id, Guest.deleted_at.is_(None), Guest.email.isnot(None))
        .scalar()
    )
    by_day_rows = (
        db.query(
            cast(Guest.created_at, Date).label("day"),
            func.count(Guest.id).label("cnt"),
        )
        .filter(
            Guest.tenant_id == tenant_id,
            Guest.deleted_at.is_(None),
            Guest.created_at >= start_30d,
        )
        .group_by("day")
        .order_by("day")
        .all()
    )
    top_countries = (
        db.query(Guest.country, func.count(Guest.id).label("cnt"))
        .filter(Guest.tenant_id == tenant_id, Guest.deleted_at.is_(None), Guest.country.isnot(None))
        .group_by(Guest.country)
        .order_by(desc("cnt"))
        .limit(30)
        .all()
    )
    recent_guests = (
        db.query(Guest)
        .filter(Guest.tenant_id == tenant_id, Guest.deleted_at.is_(None))
        .order_by(desc(Guest.created_at))
        .limit(10)
        .all()
    )

    result = {
        "totalGuests": total_guests,
        "newGuestsThisWeek": new_guests_this_week,
        "connectionsToday": connections_today,
        "emailsCollected": emails_collected,
        "registrationsByDay": [
            {"date": str(row.day), "count": row.cnt}
            for row in by_day_rows
        ],
        "topCountries": [
            {"country": row.country, "count": row.cnt}
            for row in top_countries
        ],
        "recentGuests": [
            {
                "id": g.id,
                "email": g.email,
                "firstName": g.first_name,
                "lastName": g.last_name,
                "createdAt": g.created_at,
            }
            for g in recent_guests
        ],
    }
    cache_set(cache_key, result, ttl=_TTL_STATS)
    return result
