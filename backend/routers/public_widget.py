"""
Widget pubblico recensioni — nessuna autenticazione richiesta.
Da embeddare su siti esterni via iframe.
"""
import math
from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from database import get_db
from models import ExternalReview, Site

router = APIRouter(prefix="/public", tags=["public"])

_THEMES = {
    "light": {
        "bg":      "#f9fafb",
        "card":    "#ffffff",
        "border":  "#e5e7eb",
        "text":    "#111827",
        "sub":     "#6b7280",
        "sub2":    "#4b5563",
        "powered": "#d1d5db",
        "accent":  "#6366f1",
    },
    "dark": {
        "bg":      "#111827",
        "card":    "#1f2937",
        "border":  "#374151",
        "text":    "#f9fafb",
        "sub":     "#9ca3af",
        "sub2":    "#d1d5db",
        "powered": "#4b5563",
        "accent":  "#818cf8",
    },
}


def _stars_html(rating: float | None, size: str = "1.1rem") -> str:
    if rating is None:
        return ""
    full = int(rating)
    half = 1 if (rating - full) >= 0.5 else 0
    empty = 5 - full - half
    s = f'<span style="color:#f59e0b;font-size:{size}">{"★" * full}{"⯨" * half}</span>'
    s += f'<span style="color:#d1d5db;font-size:{size}">{"★" * empty}</span>'
    return s


def _esc(s: str | None) -> str:
    if not s:
        return ""
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


@router.get("/widget/{site_id}", response_class=HTMLResponse)
def reviews_widget(
    site_id: str,
    theme: str = Query(default="light"),
    max_reviews: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    t = _THEMES.get(theme, _THEMES["light"])

    site = db.query(Site).filter(Site.id == site_id).first()
    site_name = site.name if site else "Recensioni"

    rows = (
        db.query(ExternalReview)
        .filter(ExternalReview.site_id == site_id, ExternalReview.source == "google")
        .order_by(ExternalReview.published_at.desc())
        .limit(max_reviews)
        .all()
    )

    ratings = [r.rating for r in rows if r.rating is not None]
    avg = round(sum(ratings) / len(ratings), 1) if ratings else None
    total_db = db.query(ExternalReview).filter(
        ExternalReview.site_id == site_id, ExternalReview.source == "google"
    ).count()

    # ── Reviews HTML ─────────────────────────────────────────────────────────
    cards = []
    for r in rows:
        initials = (_esc(r.author_name) or "A")[:1].upper()
        avatar = (
            f'<img src="{_esc(r.author_photo)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0">'
            if r.author_photo else
            f'<div style="width:36px;height:36px;border-radius:50%;background:{t["accent"]};display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:#fff;flex-shrink:0">{initials}</div>'
        )
        date_str = r.published_at.strftime("%-d %b %Y") if r.published_at else ""
        text_html = f'<p style="font-size:.82rem;color:{t["sub2"]};line-height:1.55;margin-top:8px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">{_esc(r.text)}</p>' if r.text else ""
        cards.append(f"""
        <div style="background:{t['card']};border:1px solid {t['border']};border-radius:12px;padding:14px 16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            {avatar}
            <div style="min-width:0">
              <div style="font-size:.85rem;font-weight:600;color:{t['text']};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{_esc(r.author_name) or 'Anonimo'}</div>
              <div style="font-size:.7rem;color:{t['sub']}">{date_str}</div>
            </div>
          </div>
          <div style="display:flex;gap:1px">{_stars_html(r.rating, '0.9rem')}</div>
          {text_html}
        </div>""")

    cards_html = "\n".join(cards) if cards else f'<p style="text-align:center;color:{t["sub"]};font-size:.85rem;padding:24px 0">Nessuna recensione ancora.</p>'

    avg_display = str(avg) if avg is not None else "—"
    avg_stars = _stars_html(avg, "1.25rem") if avg is not None else ""
    total_label = f"{total_db} recension{'e' if total_db == 1 else 'i'} su Google"

    # Google logo SVG (G colorata)
    google_g = '<svg width="16" height="16" viewBox="0 0 48 48" style="vertical-align:middle;margin-right:4px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'

    html = f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recensioni — {_esc(site_name)}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:{t['bg']};color:{t['text']};padding:16px}}
    ::-webkit-scrollbar{{width:4px}} ::-webkit-scrollbar-thumb{{background:{t['border']};border-radius:4px}}
  </style>
</head>
<body>
  <!-- Header -->
  <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid {t['border']}">
    <div style="font-size:.72rem;font-weight:600;color:{t['sub']};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
      {google_g} Recensioni Google
    </div>
    <div style="font-size:3rem;font-weight:800;color:{t['text']};line-height:1">{avg_display}</div>
    <div style="display:flex;justify-content:center;gap:2px;margin:6px 0">{avg_stars}</div>
    <div style="font-size:.78rem;color:{t['sub']}">{total_label}</div>
  </div>
  <!-- Cards -->
  <div style="display:flex;flex-direction:column;gap:10px">
    {cards_html}
  </div>
  <!-- Footer -->
  <div style="text-align:center;margin-top:16px;font-size:.65rem;color:{t['powered']}">
    Powered by Authwifi
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)
