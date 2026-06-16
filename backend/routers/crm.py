import io
import csv
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_, text, bindparam
from database import get_db
from models import Guest, WifiSession, Consent
from auth import get_current_manager, can_access_site

router = APIRouter(prefix="/crm/guests", tags=["crm"])


@router.get("")
def list_guests(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query(None),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    tenant_id = current["tenant_id"]
    skip = (page - 1) * limit

    query = db.query(Guest).filter(
        Guest.tenant_id == tenant_id,
        Guest.deleted_at.is_(None),
    )
    if current["site_ids"] is not None:
        allowed_guest_ids = (
            db.query(WifiSession.guest_id)
            .filter(WifiSession.site_id.in_(current["site_ids"]))
            .distinct()
        )
        query = query.filter(Guest.id.in_(allowed_guest_ids))
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Guest.email.ilike(s),
                Guest.first_name.ilike(s),
                Guest.last_name.ilike(s),
            )
        )

    total = query.count()
    guests = query.order_by(desc(Guest.created_at)).offset(skip).limit(limit).all()

    guest_ids = [g.id for g in guests]
    if guest_ids:
        count_rows = (
            db.query(WifiSession.guest_id, func.count(WifiSession.id).label("cnt"))
            .filter(WifiSession.guest_id.in_(guest_ids))
            .group_by(WifiSession.guest_id)
            .all()
        )
        session_counts = {r.guest_id: r.cnt for r in count_rows}

        last_stmt = text(
            'SELECT DISTINCT ON ("guestId") "guestId", "ssidName", "startedAt" '
            'FROM wifi_sessions WHERE "guestId" IN :ids '
            'ORDER BY "guestId", "startedAt" DESC'
        ).bindparams(bindparam("ids", expanding=True))
        last_rows = db.execute(last_stmt, {"ids": guest_ids}).mappings().all()
        last_sessions = {r["guestId"]: r for r in last_rows}
    else:
        session_counts = {}
        last_sessions = {}

    rows = []
    for g in guests:
        sess = last_sessions.get(g.id)
        rows.append({
            "id": g.id,
            "email": g.email,
            "firstName": g.first_name,
            "lastName": g.last_name,
            "phone": g.phone,
            "language": g.language,
            "country": g.country,
            "createdAt": g.created_at,
            "sessions": session_counts.get(g.id, 0),
            "lastVisit": sess["startedAt"] if sess else None,
            "lastSsid": sess["ssidName"] if sess else None,
        })

    return {"guests": rows, "total": total, "page": page, "limit": limit}


@router.get("/export")
def export_csv(
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    tenant_id = current["tenant_id"]
    base_q = (
        db.query(Guest)
        .filter(Guest.tenant_id == tenant_id, Guest.deleted_at.is_(None))
        .order_by(desc(Guest.created_at))
    )
    if current["site_ids"] is not None:
        allowed = (
            db.query(WifiSession.guest_id)
            .filter(WifiSession.site_id.in_(current["site_ids"]))
            .distinct()
            .subquery()
        )
        base_q = base_q.filter(Guest.id.in_(allowed))

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    writer.writerow([
        "ID", "Email", "Nome", "Cognome", "Telefono",
        "Lingua", "Paese", "MAC Address", "Sessioni", "Consensi", "Registrato",
    ])
    parts = ["﻿" + output.getvalue()]
    output.seek(0)
    output.truncate()

    BATCH = 500
    offset = 0
    while True:
        batch = base_q.offset(offset).limit(BATCH).all()
        if not batch:
            break
        batch_ids = [g.id for g in batch]

        counts = dict(
            db.query(WifiSession.guest_id, func.count(WifiSession.id))
            .filter(WifiSession.guest_id.in_(batch_ids))
            .group_by(WifiSession.guest_id)
            .all()
        )
        consent_rows = (
            db.query(Consent.guest_id, Consent.type)
            .filter(Consent.guest_id.in_(batch_ids), Consent.granted == True)
            .all()
        )
        consents_by_guest: dict = {}
        for c in consent_rows:
            consents_by_guest.setdefault(c.guest_id, []).append(c.type)

        for g in batch:
            writer.writerow([
                g.id, g.email or "", g.first_name or "", g.last_name or "",
                g.phone or "", g.language or "", g.country or "", g.mac_address or "",
                counts.get(g.id, 0),
                " | ".join(consents_by_guest.get(g.id, [])),
                g.created_at.isoformat(),
            ])
        parts.append(output.getvalue())
        output.seek(0)
        output.truncate()
        offset += BATCH

    date = datetime.now().strftime("%Y-%m-%d")
    return StreamingResponse(
        iter(parts),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="ospiti-{date}.csv"'},
    )


@router.get("/{guest_id}")
def get_guest(
    guest_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    guest = db.query(Guest).filter(
        Guest.id == guest_id,
        Guest.tenant_id == current["tenant_id"],
    ).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Ospite non trovato")

    sessions = (
        db.query(WifiSession)
        .filter(WifiSession.guest_id == guest.id)
        .order_by(desc(WifiSession.started_at))
        .limit(20)
        .options(joinedload(WifiSession.site))
        .all()
    )
    consents = (
        db.query(Consent)
        .filter(Consent.guest_id == guest.id)
        .order_by(desc(Consent.created_at))
        .all()
    )

    return {
        "id": guest.id,
        "email": guest.email,
        "firstName": guest.first_name,
        "lastName": guest.last_name,
        "phone": guest.phone,
        "language": guest.language,
        "country": guest.country,
        "macAddress": guest.mac_address,
        "createdAt": guest.created_at,
        "segmentName": guest.segment.name if guest.segment else None,
        "subSegmentName": guest.sub_segment.name if guest.sub_segment else None,
        "sessions": [
            {
                "id": s.id,
                "startedAt": s.started_at,
                "endedAt": s.ended_at,
                "ssidName": s.ssid_name,
                "apMac": s.ap_mac,
                "site": {"name": s.site.name},
            }
            for s in sessions
        ],
        "consents": [
            {
                "id": c.id,
                "type": c.type,
                "granted": c.granted,
                "policyVersion": c.policy_version,
                "createdAt": c.created_at,
            }
            for c in consents
        ],
    }
