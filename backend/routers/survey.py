import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import HTMLResponse
from jose import JWTError, jwt
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from auth import SECRET_KEY, get_current_manager, require_roles
from fastapi import HTTPException
from models import Manager
from database import get_db
from models import Guest, Site, SurveyResponse

router = APIRouter(prefix="/survey", tags=["survey"])
logger = logging.getLogger(__name__)

ALGORITHM = "HS256"


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _decode_token(token: str) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "survey":
        raise JWTError("tipo token non valido")
    return payload


def _survey_page(site: Site, token: str, error: str = "") -> str:
    primary = _esc(site.primary_color or "#0055ff")
    site_name = _esc(site.name)
    logo_tag = (
        f'<img src="{_esc(site.logo_url)}" alt="logo" style="max-height:56px;max-width:160px;object-fit:contain;margin-bottom:20px"/>'
        if site.logo_url else ""
    )
    error_block = f'<p style="color:#ef4444;font-size:.85rem;margin-bottom:16px">{_esc(error)}</p>' if error else ""

    scores = "".join(
        f'<label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer">'
        f'<input type="radio" name="nps_score" value="{i}" required style="display:none" id="s{i}"/>'
        f'<span class="score-btn" data-v="{i}" style="width:36px;height:36px;border-radius:8px;'
        f'border:2px solid #e0e0e0;display:flex;align-items:center;justify-content:center;'
        f'font-size:.85rem;font-weight:600;color:#555;cursor:pointer;transition:all .15s">{i}</span>'
        f'</label>'
        for i in range(11)
    )

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>La tua opinione — {site_name}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;
          min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}}
    .card{{background:#fff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,.1);
           max-width:480px;width:100%;padding:40px 32px}}
    h1{{font-size:1.25rem;font-weight:700;color:#111;margin-bottom:8px}}
    .sub{{font-size:.9rem;color:#777;margin-bottom:28px;line-height:1.5}}
    .label{{font-size:.85rem;font-weight:600;color:#333;margin-bottom:10px}}
    .scores{{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px}}
    .hint{{display:flex;justify-content:space-between;font-size:.72rem;color:#aaa;margin-bottom:24px}}
    textarea{{width:100%;border:1.5px solid #e0e0e0;border-radius:10px;padding:12px;
              font-size:.9rem;font-family:inherit;resize:vertical;min-height:80px;outline:none;
              transition:border-color .15s}}
    textarea:focus{{border-color:{primary}}}
    .btn{{width:100%;background:{primary};color:#fff;border:none;border-radius:10px;
          padding:14px;font-size:1rem;font-weight:600;cursor:pointer;margin-top:20px;
          transition:opacity .15s}}
    .btn:hover{{opacity:.9}}
    .score-btn.active{{background:{primary};border-color:{primary};color:#fff}}
    .powered{{font-size:.7rem;color:#ccc;text-align:center;margin-top:20px}}
  </style>
</head>
<body>
<div class="card">
  {logo_tag}
  <h1>Come è stata la tua esperienza?</h1>
  <p class="sub">La tua opinione su <strong>{site_name}</strong> ci aiuta a migliorare il servizio.</p>
  {error_block}
  <form method="post" action="/survey/{_esc(token)}">
    <p class="label">Da 0 a 10, quanto ci consiglieresti a un amico?</p>
    <div class="scores">{scores}</div>
    <div class="hint"><span>Per niente</span><span>Assolutamente</span></div>

    <p class="label" style="margin-top:4px">Vuoi aggiungere qualcosa? <span style="font-weight:400;color:#aaa">(opzionale)</span></p>
    <textarea name="comment" placeholder="Scrivi qui la tua opinione..."></textarea>

    <button type="submit" class="btn">Invia valutazione</button>
  </form>
  <p class="powered">Powered by Authwifi</p>
</div>
<script>
  document.querySelectorAll('.score-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('s' + btn.dataset.v).checked = true;
    }});
  }});
</script>
</body>
</html>"""


def _thank_you_page(site: Site, nps: int) -> str:
    primary = _esc(site.primary_color or "#0055ff")
    site_name = _esc(site.name)
    logo_tag = (
        f'<img src="{_esc(site.logo_url)}" alt="logo" style="max-height:56px;max-width:160px;object-fit:contain;margin-bottom:20px"/>'
        if site.logo_url else ""
    )

    if nps >= 9 and site.google_review_url:
        cta = f"""
        <p style="font-size:.95rem;color:#555;line-height:1.6;margin-bottom:24px">
          Siamo felici che l'esperienza ti sia piaciuta!<br/>
          Ci faresti un grande favore lasciando una recensione su Google.
        </p>
        <a href="{_esc(site.google_review_url)}" target="_blank" rel="noopener"
           style="display:inline-block;background:{primary};color:#fff;text-decoration:none;
                  padding:12px 28px;border-radius:10px;font-weight:600;font-size:.95rem">
          Lascia una recensione su Google
        </a>"""
    elif nps >= 7:
        cta = '<p style="font-size:.95rem;color:#555;line-height:1.6">Grazie per il tuo feedback, lo useremo per continuare a migliorare.</p>'
    else:
        cta = '<p style="font-size:.95rem;color:#555;line-height:1.6">Grazie per aver condiviso la tua esperienza. Il tuo feedback è prezioso — lo trasmetteremo allo staff per migliorare il servizio.</p>'

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Grazie — {site_name}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;
          min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}}
    .card{{background:#fff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,.1);
           max-width:420px;width:100%;padding:40px 32px;text-align:center}}
    .check{{width:64px;height:64px;border-radius:50%;background:{primary};display:flex;
             align-items:center;justify-content:center;margin:0 auto 20px}}
    h1{{font-size:1.4rem;font-weight:700;color:#111;margin-bottom:12px}}
    .powered{{font-size:.7rem;color:#ccc;margin-top:24px}}
  </style>
</head>
<body>
<div class="card">
  {logo_tag}
  <div class="check">
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff"
         stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>
  <h1>Grazie mille!</h1>
  {cta}
  <p class="powered">Powered by Authwifi</p>
</div>
</body>
</html>"""


@router.post("/send-test")
def send_test_email(
    site_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    import os
    from models import Manager
    from services.email import send_survey_email

    manager = db.query(Manager).filter(Manager.id == current["id"]).first()
    if not manager or not manager.email:
        raise HTTPException(status_code=400, detail="Email manager non trovata")

    site_name = "Authwifi"
    if site_id:
        site = db.query(Site).filter(
            Site.id == site_id,
            Site.tenant_id == current["tenant_id"],
        ).first()
        if site:
            site_name = site.name

    token = jwt.encode(
        {"type": "survey", "guest_id": "test", "site_id": site_id or "test", "tenant_id": current["tenant_id"]},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    survey_url = f"{os.getenv('BASE_URL', 'http://localhost:8000')}/survey/{token}"

    ok = send_survey_email(manager.email, manager.first_name or "Manager", survey_url, site_name)
    if ok:
        return {"success": True, "sentTo": manager.email}
    raise HTTPException(status_code=500, detail="Errore invio. Verifica SENDGRID_API_KEY nei log del server.")


@router.get("/responses")
def list_responses(
    site_id: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    q = (
        db.query(SurveyResponse, Guest, Site)
        .join(Guest, SurveyResponse.guest_id == Guest.id)
        .join(Site, SurveyResponse.site_id == Site.id)
        .filter(
            SurveyResponse.tenant_id == current["tenant_id"],
            SurveyResponse.submitted_at.isnot(None),
        )
    )
    if site_id:
        q = q.filter(SurveyResponse.site_id == site_id)
    if current["site_ids"] is not None:
        q = q.filter(SurveyResponse.site_id.in_(current["site_ids"]))

    total = q.count()

    # Aggregate stats
    stats_q = db.query(
        func.avg(SurveyResponse.nps_score).label("avg"),
        func.count(SurveyResponse.id).label("total"),
        func.sum(case((SurveyResponse.nps_score >= 9, 1), else_=0)).label("promoters"),
        func.sum(case((SurveyResponse.nps_score <= 6, 1), else_=0)).label("detractors"),
    ).filter(
        SurveyResponse.tenant_id == current["tenant_id"],
        SurveyResponse.submitted_at.isnot(None),
    )
    if site_id:
        stats_q = stats_q.filter(SurveyResponse.site_id == site_id)
    if current["site_ids"] is not None:
        stats_q = stats_q.filter(SurveyResponse.site_id.in_(current["site_ids"]))
    stats = stats_q.first()

    rows = q.order_by(SurveyResponse.submitted_at.desc()).offset(skip).limit(limit).all()

    items = [
        {
            "id": sr.id,
            "npsScore": sr.nps_score,
            "comment": sr.comment,
            "submittedAt": sr.submitted_at.isoformat() if sr.submitted_at else None,
            "guestEmail": g.email,
            "guestFirstName": g.first_name,
            "guestLastName": g.last_name,
            "siteName": s.name,
            "siteId": sr.site_id,
        }
        for sr, g, s in rows
    ]

    avg_nps = round(float(stats.avg), 1) if stats and stats.avg is not None else None
    n = stats.total or 0
    promoters_pct = round((stats.promoters or 0) / n * 100) if n else 0
    detractors_pct = round((stats.detractors or 0) / n * 100) if n else 0

    return {
        "total": total,
        "avgNps": avg_nps,
        "promotersPct": promoters_pct,
        "detractorsPct": detractors_pct,
        "passivesPct": 100 - promoters_pct - detractors_pct if n else 0,
        "items": items,
    }


@router.get("/{token}", response_class=HTMLResponse)
def survey_form(token: str, db: Session = Depends(get_db)):
    try:
        payload = _decode_token(token)
    except JWTError:
        return HTMLResponse("<h2>Link non valido o scaduto.</h2>", status_code=400)

    site = db.query(Site).filter(Site.id == payload["site_id"]).first()
    if not site:
        return HTMLResponse("<h2>Sito non trovato.</h2>", status_code=404)

    sr = db.query(SurveyResponse).filter(SurveyResponse.survey_token == token).first()
    if sr and sr.submitted_at:
        return HTMLResponse(_thank_you_page(site, sr.nps_score or 0))

    return HTMLResponse(_survey_page(site, token))


@router.post("/{token}", response_class=HTMLResponse)
def survey_submit(
    token: str,
    nps_score: int = Form(...),
    comment: str = Form(default=""),
    db: Session = Depends(get_db),
):
    try:
        payload = _decode_token(token)
    except JWTError:
        return HTMLResponse("<h2>Link non valido o scaduto.</h2>", status_code=400)

    if not (0 <= nps_score <= 10):
        site = db.query(Site).filter(Site.id == payload["site_id"]).first()
        return HTMLResponse(_survey_page(site, token, "Seleziona un punteggio da 0 a 10."))

    site = db.query(Site).filter(Site.id == payload["site_id"]).first()
    if not site:
        return HTMLResponse("<h2>Sito non trovato.</h2>", status_code=404)

    sr = db.query(SurveyResponse).filter(SurveyResponse.survey_token == token).first()
    if sr:
        if sr.submitted_at:
            return HTMLResponse(_thank_you_page(site, sr.nps_score or nps_score))
        sr.nps_score = nps_score
        sr.comment = comment.strip() or None
        sr.submitted_at = datetime.utcnow()
    else:
        sr = SurveyResponse(
            guest_id=payload["guest_id"],
            site_id=payload["site_id"],
            tenant_id=payload["tenant_id"],
            nps_score=nps_score,
            comment=comment.strip() or None,
            survey_token=token,
            submitted_at=datetime.utcnow(),
        )
        db.add(sr)

    db.commit()
    logger.info("Survey completata: guest %s NPS %d", payload["guest_id"], nps_score)
    return HTMLResponse(_thank_you_page(site, nps_score))
