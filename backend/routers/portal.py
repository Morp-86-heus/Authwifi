import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models import Site, Guest, WifiSession, Consent, MacWhitelist, MacBlacklist, Segment, SubSegment
from services.omada import OmadaClient
from services.splash import render_splash

router = APIRouter(prefix="/portal", tags=["portal"])
omada_client = OmadaClient()
logger = logging.getLogger(__name__)


class GuestLoginDto(BaseModel):
    site_id: str
    client_mac: str
    ap_mac: str
    ssid_name: str
    radio_id: Optional[str] = "0"
    omada_site_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    consents: List[str] = []


@router.get("/test-omada")
async def test_omada():
    import os
    try:
        session = await omada_client.get_session(
            os.getenv("OMADA_CONTROLLER_URL", ""),
            os.getenv("OMADA_OMADAC_ID", ""),
            os.getenv("OMADA_OPERATOR_USERNAME", ""),
            os.getenv("OMADA_OPERATOR_PASSWORD", ""),
        )
        return {
            "success": True,
            "csrfToken": session["csrf_token"],
            "cookiePreview": session["cookie"][:40] + "...",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/splash", response_class=HTMLResponse)
async def splash(
    siteId: str = Query(...),
    clientMac: str = Query(default=""),
    apMac: str = Query(default=""),
    ssidName: str = Query(default=""),
    radioId: str = Query(default="0"),
    site: str = Query(default=""),
    redirectUrl: str = Query(default=""),
    db: Session = Depends(get_db),
):
    from services.cache import cache_get, cache_set, TTL_SITE, TTL_LISTS

    # ── 1. Site meta (5 min cache) ──────────────────────────────────────────
    site_meta = cache_get(f"site_meta:{siteId}")
    if site_meta is None:
        db_site = db.query(Site).filter(Site.id == siteId).first()
        if not db_site:
            raise HTTPException(status_code=404, detail="Sito non trovato")
        tenant = db_site.tenant
        site_meta = {
            "tenant_id":            db_site.tenant_id,
            "site_name":            db_site.name,
            "tenant_name":          tenant.name,
            "logo_url":             db_site.logo_url or tenant.logo_url,
            "background_image_url": db_site.background_image_url,
            "hero_image_url":       db_site.hero_image_url,
            "primary_color":        db_site.primary_color,
            "accent_color":         db_site.accent_color,
            "welcome_title":        db_site.welcome_title,
            "welcome_text":         db_site.welcome_text,
            "login_methods":        [m.strip() for m in db_site.login_methods.split(",")],
            "social": {
                "facebook":    db_site.facebook_url,
                "instagram":   db_site.instagram_url,
                "tripadvisor": db_site.tripadvisor_url,
                "google":      db_site.google_review_url,
                "booking":     db_site.booking_url,
                "twitter":     db_site.twitter_url,
            },
            "_omada_controller_url": db_site.omada_controller_url,
            "_omada_omadac_id":      db_site.omada_omadac_id,
            "_omada_site_id":        db_site.omada_site_id,
            "_omada_operator_user":  db_site.omada_operator_user,
            "_omada_operator_pass":  db_site.omada_operator_pass,
        }
        cache_set(f"site_meta:{siteId}", site_meta, TTL_SITE)

    tenant_id = site_meta["tenant_id"]

    # ── 2. Blacklist check (2 min cache) ────────────────────────────────────
    if clientMac:
        bl_macs = cache_get(f"blacklist_macs:{siteId}")
        if bl_macs is None:
            bl_macs = [r.mac_address for r in db.query(MacBlacklist).filter(
                MacBlacklist.site_id == siteId).all()]
            cache_set(f"blacklist_macs:{siteId}", bl_macs, TTL_LISTS)
        if clientMac.upper() in bl_macs:
            return HTMLResponse(f"""<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Accesso negato</title>
<style>*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}}
.card{{background:#fff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,.12);max-width:360px;width:100%;padding:40px 32px;text-align:center}}
.icon{{width:64px;height:64px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}}
h1{{font-size:1.4rem;font-weight:700;color:#111;margin-bottom:10px}}
p{{font-size:.9rem;color:#666;line-height:1.5}}</style>
</head><body><div class="card">
<div class="icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
<h1>Accesso negato</h1>
<p>Il tuo dispositivo non è autorizzato a connettersi a questa rete WiFi.<br/>Contatta la reception per assistenza.</p>
</div></body></html>""", status_code=403)

    # ── 3. Whitelist bypass (2 min cache) ───────────────────────────────────
    if clientMac:
        wl_macs = cache_get(f"whitelist_macs:{siteId}")
        if wl_macs is None:
            wl_macs = [r.mac_address for r in db.query(MacWhitelist).filter(
                MacWhitelist.site_id == siteId).all()]
            cache_set(f"whitelist_macs:{siteId}", wl_macs, TTL_LISTS)
        if clientMac.upper() in wl_macs:
            guest = db.query(Guest).filter(
                Guest.mac_address == clientMac,
                Guest.tenant_id == tenant_id,
            ).first()
            if not guest:
                guest = Guest(tenant_id=tenant_id, mac_address=clientMac)
                db.add(guest)
                db.flush()
            db.add(WifiSession(
                guest_id=guest.id, site_id=siteId,
                mac_address=clientMac, ap_mac=apMac or None, ssid_name=ssidName or None,
            ))
            db.commit()
            if all([site_meta["_omada_controller_url"], site_meta["_omada_omadac_id"], site_meta["_omada_site_id"]]):
                try:
                    await omada_client.authorize_client(
                        controller_url=site_meta["_omada_controller_url"],
                        omadac_id=site_meta["_omada_omadac_id"],
                        site_id=site_meta["_omada_site_id"],
                        operator_user=site_meta["_omada_operator_user"],
                        operator_pass=site_meta["_omada_operator_pass"],
                        client_mac=clientMac,
                        ap_mac=apMac,
                        ssid_name=ssidName,
                        radio_id=radioId or "0",
                    )
                except Exception as e:
                    logger.error(f"Whitelist Omada auth error: {e}")
            dest = redirectUrl if redirectUrl else f"/portal/welcome?siteId={siteId}"
            return RedirectResponse(dest, status_code=302)

    # ── 4. Returning guest (sempre DB — per MAC) ────────────────────────────
    returning_guest = None
    if clientMac:
        rg = db.query(Guest).filter(
            Guest.mac_address == clientMac,
            Guest.tenant_id == tenant_id,
            Guest.deleted_at.is_(None),
        ).first()
        if rg:
            returning_guest = {
                "first_name": rg.first_name,
                "last_name":  rg.last_name,
                "email":      rg.email,
            }

    # ── 5. Segments (5 min cache) ────────────────────────────────────────────
    segments_data = cache_get(f"segments:{tenant_id}")
    if segments_data is None:
        active_segments = db.query(Segment).filter(
            Segment.tenant_id == tenant_id,
            Segment.enabled == True,
        ).order_by(Segment.priority, Segment.name).all()
        seg_ids = [s.id for s in active_segments]
        if seg_ids:
            all_subs = db.query(SubSegment).filter(
                SubSegment.segment_id.in_(seg_ids),
                SubSegment.enabled == True,
            ).order_by(SubSegment.name).all()
            subs_by_seg: dict = {}
            for s in all_subs:
                subs_by_seg.setdefault(s.segment_id, []).append(s)
        else:
            subs_by_seg = {}
        segments_data = [
            {
                "id": seg.id,
                "name": seg.name,
                "sub_segments": [
                    {"id": s.id, "name": s.text_it or s.name}
                    for s in subs_by_seg.get(seg.id, [])
                ],
            }
            for seg in active_segments
        ]
        cache_set(f"segments:{tenant_id}", segments_data, TTL_SITE)

    html = render_splash({
        "site_name":            site_meta["site_name"],
        "tenant_name":          site_meta["tenant_name"],
        "logo_url":             site_meta["logo_url"],
        "background_image_url": site_meta["background_image_url"],
        "hero_image_url":       site_meta["hero_image_url"],
        "primary_color":        site_meta["primary_color"],
        "accent_color":         site_meta["accent_color"],
        "welcome_title":        site_meta["welcome_title"],
        "welcome_text":         site_meta["welcome_text"],
        "login_methods":        site_meta["login_methods"],
        "site_id":              siteId,
        "client_mac":           clientMac,
        "ap_mac":               apMac,
        "ssid_name":            ssidName,
        "radio_id":             radioId,
        "omada_site_id":        site,
        "redirect_url":         redirectUrl,
        "returning_guest":      returning_guest,
        "segments":             segments_data,
        "social":               site_meta["social"],
    })
    return HTMLResponse(content=html)



@router.post("/login")
async def guest_login(
    site_id: str = Form(...),
    client_mac: str = Form(default=""),
    ap_mac: str = Form(default=""),
    ssid_name: str = Form(default=""),
    radio_id: str = Form(default="0"),
    omada_site_id: str = Form(default=""),
    redirect_url: str = Form(default=""),
    loginMethod: str = Form(default="clickthrough"),
    first_name: Optional[str] = Form(default=None),
    last_name: Optional[str] = Form(default=None),
    email: Optional[str] = Form(default=None),
    phone: Optional[str] = Form(default=None),
    language: Optional[str] = Form(default=None),
    country: Optional[str] = Form(default=None),
    segment_id: Optional[str] = Form(default=None),
    sub_segment_id: Optional[str] = Form(default=None),
    consents: List[str] = Form(default=[]),
    db: Session = Depends(get_db),
):
    db_site = db.query(Site).filter(Site.id == site_id).first()
    if not db_site:
        return HTMLResponse("<html><body><p>Sito non trovato.</p></body></html>", status_code=404)

    # Upsert guest
    guest = None
    if client_mac:
        guest = db.query(Guest).filter(
            Guest.tenant_id == db_site.tenant_id,
            Guest.mac_address == client_mac,
            Guest.deleted_at.is_(None),
        ).first()

    if not guest and email:
        guest = db.query(Guest).filter(
            Guest.tenant_id == db_site.tenant_id,
            Guest.email == email,
            Guest.deleted_at.is_(None),
        ).first()
        if guest and client_mac:
            guest.mac_address = client_mac
            db.flush()

    if not guest:
        guest = Guest(
            tenant_id=db_site.tenant_id,
            mac_address=client_mac or None,
            email=email or None,
            first_name=first_name or None,
            last_name=last_name or None,
            phone=phone or None,
            language=language or None,
            country=country or None,
            segment_id=segment_id or None,
            sub_segment_id=sub_segment_id or None,
        )
        db.add(guest)
        db.flush()
    else:
        if first_name and not guest.first_name:
            guest.first_name = first_name
        if email and not guest.email:
            guest.email = email
        if phone and not guest.phone:
            guest.phone = phone
        if country and not guest.country:
            guest.country = country
        if segment_id:
            guest.segment_id = segment_id
            # Clear sub_segment when segment changes to avoid dangling FK
            guest.sub_segment_id = sub_segment_id or None
        elif sub_segment_id:
            guest.sub_segment_id = sub_segment_id

    # Consensi
    for consent_type in consents:
        existing = db.query(Consent).filter(
            Consent.guest_id == guest.id,
            Consent.type == consent_type,
        ).first()
        if not existing:
            db.add(Consent(
                guest_id=guest.id,
                type=consent_type,
                granted=True,
                policy_version="1.0",
            ))

    # Sessione WiFi
    wifi_session = WifiSession(
        guest_id=guest.id,
        site_id=db_site.id,
        mac_address=client_mac or "",
        ap_mac=ap_mac or None,
        ssid_name=ssid_name or None,
    )
    db.add(wifi_session)
    db.commit()

    # Autorizza su Omada (non bloccante)
    if all([db_site.omada_controller_url, db_site.omada_omadac_id, db_site.omada_site_id]):
        try:
            await omada_client.authorize_client(
                controller_url=db_site.omada_controller_url,
                omadac_id=db_site.omada_omadac_id,
                site_id=db_site.omada_site_id,
                operator_user=db_site.omada_operator_user,
                operator_pass=db_site.omada_operator_pass,
                client_mac=client_mac,
                ap_mac=ap_mac,
                ssid_name=ssid_name,
                radio_id=radio_id or "0",
            )
        except Exception as e:
            logger.error(f"Omada auth error: {e}")

    destination = redirect_url if redirect_url else f"/portal/welcome?siteId={site_id}"
    return RedirectResponse(destination, status_code=302)


@router.get("/welcome", response_class=HTMLResponse)
def welcome(siteId: str = Query(default=""), db: Session = Depends(get_db)):
    from services.splash import esc, SOCIAL_META
    site = db.query(Site).filter(Site.id == siteId).first() if siteId else None

    social_links = []
    if site:
        social = {
            "facebook":    site.facebook_url,
            "instagram":   site.instagram_url,
            "tripadvisor": site.tripadvisor_url,
            "google":      site.google_review_url,
            "booking":     site.booking_url,
            "twitter":     site.twitter_url,
        }
        for key, (color, name, path) in SOCIAL_META.items():
            url = social.get(key)
            if url:
                social_links.append(
                    f'<a href="{esc(url)}" target="_blank" rel="noopener" '
                    f'style="display:inline-flex;align-items:center;justify-content:center;'
                    f'width:48px;height:48px;border-radius:50%;background:{color};margin:0 6px;text-decoration:none">'
                    f'<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" style="pointer-events:none" xmlns="http://www.w3.org/2000/svg">'
                    f'<path d="{path}"/></svg></a>'
                )

    social_block = (
        f'<div style="margin:28px 0 8px">{"".join(social_links)}</div>'
        if social_links else ""
    )
    follow_label = '<p style="font-size:.8rem;color:#aaa;margin-bottom:20px">Seguici sui social</p>' if social_links else ""
    site_name = esc(site.name) if site else "Authwifi"

    primary = site.primary_color if site else "#0055ff"
    logo = (
        f'<img src="{esc(site.logo_url)}" alt="logo" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:20px"/>'
        if site and site.logo_url else ""
    )

    return HTMLResponse(f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Connesso – {site_name}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}}
    .card{{background:#fff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,.12);max-width:380px;width:100%;padding:40px 32px;text-align:center}}
    .check{{width:64px;height:64px;border-radius:50%;background:{primary};display:flex;align-items:center;justify-content:center;margin:0 auto 20px}}
    h1{{font-size:1.5rem;font-weight:700;color:#111;margin-bottom:8px}}
    p{{font-size:.95rem;color:#666;line-height:1.5}}
    .divider{{height:1px;background:#f0f0f0;margin:24px 0}}
    .powered{{font-size:.72rem;color:#ccc;margin-top:24px}}
  </style>
</head>
<body>
  <div class="card">
    {logo}
    <div class="check">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h1>Sei connesso!</h1>
    <p>Benvenuto. Ora puoi navigare liberamente su Internet.</p>
    {f'<div class="divider"></div>{social_block}{follow_label}' if social_links else ''}
    <p class="powered">WiFi powered by Authwifi</p>
  </div>
</body>
</html>""")
