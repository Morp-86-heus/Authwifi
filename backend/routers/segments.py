from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from pydantic import BaseModel
from database import get_db
from models import Segment, SubSegment, Guest
from auth import get_current_manager

router = APIRouter(prefix="/segments", tags=["segments"])


class SegmentIn(BaseModel):
    name: str
    priority: int = 0
    enabled: bool = True


class SubSegmentIn(BaseModel):
    segment_id: str
    name: str
    text_it: Optional[str] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    recurring: bool = False
    enabled: bool = True


# ─── Segments ─────────────────────────────────────────────────────────────────

@router.get("")
def list_segments(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    tenant_id = current["tenant_id"]
    skip = (page - 1) * limit
    q = db.query(Segment).filter(Segment.tenant_id == tenant_id)
    total = q.count()
    items = q.order_by(Segment.priority, Segment.name).offset(skip).limit(limit).all()
    return {
        "segments": [
            {
                "id": s.id,
                "name": s.name,
                "priority": s.priority,
                "enabled": s.enabled,
                "createdAt": s.created_at,
            }
            for s in items
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }




@router.get("/full")
def list_segments_full(
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    """Restituisce tutti i segmenti con i relativi sotto-segmenti."""
    tenant_id = current["tenant_id"]
    items = (
        db.query(Segment)
        .options(joinedload(Segment.sub_segments))
        .filter(Segment.tenant_id == tenant_id)
        .order_by(Segment.priority, Segment.name)
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "subSegments": [
                {"id": ss.id, "name": ss.name}
                for ss in (s.sub_segments or [])
            ],
        }
        for s in items
    ]

@router.post("")
def create_segment(
    body: SegmentIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    seg = Segment(tenant_id=current["tenant_id"], **body.model_dump())
    db.add(seg)
    db.commit()
    db.refresh(seg)
    from services.cache import cache_delete
    cache_delete(f'segments:{current["tenant_id"]}')
    return {"id": seg.id, "name": seg.name, "priority": seg.priority, "enabled": seg.enabled, "createdAt": seg.created_at}


@router.patch("/{seg_id}")
def update_segment(
    seg_id: str,
    body: SegmentIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    seg = db.query(Segment).filter(
        Segment.id == seg_id, Segment.tenant_id == current["tenant_id"]
    ).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Segmento non trovato")
    for k, v in body.model_dump().items():
        setattr(seg, k, v)
    db.commit()
    from services.cache import cache_delete
    cache_delete(f'segments:{current["tenant_id"]}')
    return {"id": seg.id, "name": seg.name, "priority": seg.priority, "enabled": seg.enabled}


@router.delete("/{seg_id}", status_code=204)
def delete_segment(
    seg_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    seg = db.query(Segment).filter(
        Segment.id == seg_id, Segment.tenant_id == current["tenant_id"]
    ).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Segmento non trovato")
    # Nullify guest FK references before cascade-deleting sub_segments
    sub_ids = [s.id for s in seg.sub_segments]
    if sub_ids:
        db.query(Guest).filter(Guest.sub_segment_id.in_(sub_ids)).update(
            {"sub_segment_id": None}, synchronize_session=False
        )
    db.query(Guest).filter(Guest.segment_id == seg_id).update(
        {"segment_id": None}, synchronize_session=False
    )
    db.delete(seg)
    db.commit()
    from services.cache import cache_delete
    cache_delete(f'segments:{current["tenant_id"]}')


# ─── Sub-segments ─────────────────────────────────────────────────────────────

@router.get("/sub-segments")
def list_sub_segments(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    segment_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    tenant_id = current["tenant_id"]
    skip = (page - 1) * limit
    q = db.query(SubSegment).filter(SubSegment.tenant_id == tenant_id)
    if segment_id:
        q = q.filter(SubSegment.segment_id == segment_id)
    total = q.count()
    items = (
        q.options(joinedload(SubSegment.segment))
        .order_by(SubSegment.name)
        .offset(skip)
        .limit(limit)
        .all()
    )

    sub_ids = [s.id for s in items]
    if sub_ids:
        online_rows = (
            db.query(Guest.sub_segment_id, func.count(Guest.id).label("cnt"))
            .filter(
                Guest.sub_segment_id.in_(sub_ids),
                Guest.tenant_id == tenant_id,
                Guest.deleted_at.is_(None),
            )
            .group_by(Guest.sub_segment_id)
            .all()
        )
        online_counts = {r.sub_segment_id: r.cnt for r in online_rows}
    else:
        online_counts = {}

    rows = []
    for s in items:
        rows.append({
            "id": s.id,
            "segmentId": s.segment_id,
            "segmentName": s.segment.name,
            "name": s.name,
            "textIt": s.text_it,
            "dateStart": s.date_start,
            "dateEnd": s.date_end,
            "recurring": s.recurring,
            "online": online_counts.get(s.id, 0),
            "enabled": s.enabled,
            "createdAt": s.created_at,
        })
    return {"subSegments": rows, "total": total, "page": page, "limit": limit}


@router.post("/sub-segments")
def create_sub_segment(
    body: SubSegmentIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    seg = db.query(Segment).filter(
        Segment.id == body.segment_id, Segment.tenant_id == current["tenant_id"]
    ).first()
    if not seg:
        raise HTTPException(status_code=400, detail="Segmento non trovato")
    sub = SubSegment(tenant_id=current["tenant_id"], **body.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    from services.cache import cache_delete
    cache_delete(f'segments:{current["tenant_id"]}')
    return {"id": sub.id, "name": sub.name, "segmentId": sub.segment_id}


@router.patch("/sub-segments/{sub_id}")
def update_sub_segment(
    sub_id: str,
    body: SubSegmentIn,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    sub = db.query(SubSegment).filter(
        SubSegment.id == sub_id, SubSegment.tenant_id == current["tenant_id"]
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Sotto-segmento non trovato")
    if body.segment_id != sub.segment_id:
        seg = db.query(Segment).filter(
            Segment.id == body.segment_id, Segment.tenant_id == current["tenant_id"]
        ).first()
        if not seg:
            raise HTTPException(status_code=400, detail="Segmento non trovato")
    for k, v in body.model_dump().items():
        setattr(sub, k, v)
    db.commit()
    from services.cache import cache_delete
    cache_delete(f'segments:{current["tenant_id"]}')
    return {"id": sub.id, "name": sub.name}


@router.delete("/sub-segments/{sub_id}", status_code=204)
def delete_sub_segment(
    sub_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    sub = db.query(SubSegment).filter(
        SubSegment.id == sub_id, SubSegment.tenant_id == current["tenant_id"]
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Sotto-segmento non trovato")
    # Nullify guest FK references before deleting
    db.query(Guest).filter(Guest.sub_segment_id == sub_id).update(
        {"sub_segment_id": None}, synchronize_session=False
    )
    db.delete(sub)
    db.commit()
    from services.cache import cache_delete
    cache_delete(f'segments:{current["tenant_id"]}')
