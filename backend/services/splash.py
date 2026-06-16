import json
from html import escape as _esc


def esc(s) -> str:
    if not s:
        return ""
    return _esc(str(s), quote=True)


SOCIAL_META = {
    "facebook":    ("#1877f2", "Facebook",    "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"),
    "instagram":   ("#e1306c", "Instagram",   "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"),
    "tripadvisor": ("#34e0a1", "TripAdvisor", "M12.006 4.295c-2.073 0-4.14.53-5.99 1.58L4 5.87l2.068.023C4.916 6.987 4.158 8.345 4.158 9.88c0 2.648 2.15 4.8 4.8 4.8.96 0 1.853-.284 2.6-.77l.448.624.448-.623c.747.486 1.64.77 2.6.77 2.648 0 4.8-2.152 4.8-4.8 0-1.536-.758-2.894-1.91-3.988L20 5.87l-2.016.005c-1.85-1.05-3.918-1.58-5.978-1.58zm-3.048 3.12c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7-2.7-1.21-2.7-2.7 1.21-2.7 2.7-2.7zm6.096 0c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7-2.7-1.21-2.7-2.7 1.21-2.7 2.7-2.7zm-6.096 1.35a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7zm6.096 0a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7z"),
    "google":      ("#ea4335", "Google",      "M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"),
    "booking":     ("#003580", "Booking.com", "M17.28 11.36c.63-.84.96-1.87.96-2.94C18.24 5.09 15.15 2 11.32 2H4v20h7.85c4.05 0 7.32-3.28 7.32-7.32 0-1.43-.42-2.76-1.14-3.87l-.75.55zM8.5 6h2.82c1.38 0 2.5 1.12 2.5 2.5S12.7 11 11.32 11H8.5V6zm3.35 12H8.5v-5h3.35c1.65 0 3 1.35 3 3s-1.35 2-3 2z"),
    "twitter":     ("#000000", "X (Twitter)", "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"),
}


def render_splash(d: dict) -> str:
    login_methods = d.get("login_methods", [])
    has_email = "email" in login_methods
    returning_guest = d.get("returning_guest")
    social = d.get("social", {})

    # Build social icons row (only configured URLs)
    social_links = []
    for key, (color, name, path) in SOCIAL_META.items():
        url = social.get(key)
        if url:
            social_links.append(
                f'<a href="{esc(url)}" target="_blank" rel="noopener" title="{name}" '
                f'style="display:inline-flex;align-items:center;justify-content:center;'
                f'width:38px;height:38px;border-radius:50%;background:{color};margin:0 4px;text-decoration:none">'
                f'<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" style="pointer-events:none" xmlns="http://www.w3.org/2000/svg">'
                f'<path d="{path}"/></svg></a>'
            )
    social_block = (
        f'<div style="text-align:center;margin-top:20px">{"".join(social_links)}</div>'
        if social_links else ""
    )

    hidden = f"""
    <input type="hidden" name="site_id"       value="{esc(d.get('site_id'))}"/>
    <input type="hidden" name="client_mac"    value="{esc(d.get('client_mac'))}"/>
    <input type="hidden" name="ap_mac"        value="{esc(d.get('ap_mac'))}"/>
    <input type="hidden" name="ssid_name"     value="{esc(d.get('ssid_name'))}"/>
    <input type="hidden" name="radio_id"      value="{esc(d.get('radio_id', '0'))}"/>
    <input type="hidden" name="omada_site_id" value="{esc(d.get('omada_site_id'))}"/>
    """

    # Returning guest — simplified reconnect form
    if returning_guest:
        first = esc(returning_guest.get("first_name") or "")
        last  = esc(returning_guest.get("last_name") or "")
        name  = (first + " " + last).strip() or esc(returning_guest.get("email") or "Ospite")
        reconnect_form = f"""
    <div class="returning-box">
      <p class="returning-name">Bentornato, {name}!</p>
      <p class="returning-sub">La tua sessione WiFi è scaduta.</p>
    </div>
    <form method="POST" action="/portal/login">
      {hidden}
      <input type="hidden" name="loginMethod" value="renewal"/>
      <button type="submit" class="btn-primary">Rinnova connessione &rarr;</button>
    </form>
    <p class="terms-note" style="margin-top:14px">
      Cliccando accetti i <a href="/legal/terms" target="_blank">Termini di servizio</a>.
    </p>
        """

        pc = esc(d.get("primary_color", "#0055ff"))
        ac = esc(d.get("accent_color", "#f5f5f5"))
        bg_img = d.get("background_image_url")
        bg_style = (
            f"background:url('{esc(bg_img)}') center/cover no-repeat fixed;background-color:{ac};"
            if bg_img else f"background:{ac};"
        )
        overlay_css = (
            "body::before{content:'';position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:0;}"
            if bg_img else ""
        )
        hero = f'<img src="{esc(d.get("hero_image_url"))}" class="hero-img" alt=""/>' if d.get("hero_image_url") else ""
        logo = (
            f'<div class="logo-wrap"><img src="{esc(d.get("logo_url"))}" alt="logo"/></div>'
            if d.get("logo_url") else ""
        )
        return f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="robots" content="noindex"/>
  <title>WiFi {esc(d.get('site_name'))}</title>
  <style>
    *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;{bg_style}min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}}
    {overlay_css}
    .card{{background:#fff;border-radius:16px;overflow:hidden;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.18);position:relative;z-index:1}}
    .card-body{{padding:32px 32px 36px}}
    .hero-img{{width:100%;height:160px;object-fit:cover;display:block}}
    .logo-wrap{{text-align:center;margin-bottom:20px}}
    .logo-wrap img{{max-height:64px;max-width:180px;object-fit:contain}}
    .welcome-title{{font-size:1.4rem;font-weight:700;color:#111;text-align:center;margin-bottom:6px}}
    .welcome-text{{font-size:.92rem;color:#555;text-align:center;margin-bottom:24px;line-height:1.5}}
    .returning-box{{text-align:center;margin-bottom:24px}}
    .returning-name{{font-size:1.2rem;font-weight:700;color:#111;margin-bottom:6px}}
    .returning-sub{{font-size:.9rem;color:#777}}
    .btn-primary{{width:100%;padding:13px;background:{pc};color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer}}
    .terms-note{{font-size:.82rem;color:#666;text-align:center}}
    .terms-note a{{color:{pc};text-decoration:none}}
    .powered-by{{text-align:center;margin-top:24px;font-size:.75rem;color:#ccc}}
  </style>
</head>
<body>
  <div class="card">
    {hero}
    <div class="card-body">
      {logo}
      <h1 class="welcome-title">{esc(d.get('welcome_title', 'Benvenuto!'))}</h1>
      {reconnect_form}
      <p class="powered-by">WiFi powered by Authwifi</p>
    </div>
  </div>
</body>
</html>"""

    segments = d.get("segments", [])
    if segments:
        segs_json = json.dumps([
            {"id": s["id"], "name": s["name"],
             "subs": [{"id": ss["id"], "name": ss["name"]} for ss in s["sub_segments"]]}
            for s in segments
        ], ensure_ascii=False).replace("</", "<\\/")
        seg_options = "".join(
            f'<option value="{esc(s["id"])}">{esc(s["name"])}</option>'
            for s in segments
        )
        profiling_section = f"""
      <div class="profiling-divider"><span>Aiutaci a conoscerti meglio</span></div>
      <div class="field">
        <select name="segment_id" id="seg-sel" onchange="filterSubs(this.value)">
          <option value="">Come passerai le tue vacanze? (opzionale)</option>
          {seg_options}
        </select>
      </div>
      <div class="field" id="subseg-wrap" style="display:none">
        <select name="sub_segment_id" id="subseg-sel">
          <option value="">Interessi specifici (opzionale)</option>
        </select>
      </div>
      <script>
        var _SEGS={segs_json};
        function filterSubs(id){{
          var w=document.getElementById('subseg-wrap');
          var s=document.getElementById('subseg-sel');
          s.innerHTML='<option value="">Interessi specifici (opzionale)</option>';
          if(!id){{w.style.display='none';return;}}
          var seg=_SEGS.find(function(x){{return x.id===id;}});
          if(!seg||!seg.subs.length){{w.style.display='none';return;}}
          seg.subs.forEach(function(sub){{
            var o=document.createElement('option');
            o.value=sub.id; o.textContent=sub.name; s.appendChild(o);
          }});
          w.style.display='block';
        }}
      </script>"""
    else:
        profiling_section = ""

    email_form = ""
    if has_email:
        email_form = f"""
    <form id="form-email" method="POST" action="/portal/login">
      {hidden}
      <input type="hidden" name="loginMethod" value="email"/>
      <div class="field">
        <input type="text"  name="first_name" placeholder="Nome *" required autocomplete="given-name"/>
      </div>
      <div class="field">
        <input type="text"  name="last_name"  placeholder="Cognome *" required autocomplete="family-name"/>
      </div>
      <div class="field">
        <input type="email" name="email"      placeholder="Email *" required autocomplete="email"/>
      </div>
      <div class="field">
        <input type="tel"   name="phone"      placeholder="Telefono *" required autocomplete="tel"/>
      </div>
      <div class="field">
        <select name="country" required autocomplete="country">
          <option value="">Paese di provenienza</option>
          <option value="IT">🇮🇹 Italia</option>
          <option value="DE">🇩🇪 Germania</option>
          <option value="FR">🇫🇷 Francia</option>
          <option value="GB">🇬🇧 Regno Unito</option>
          <option value="US">🇺🇸 Stati Uniti</option>
          <option value="ES">🇪🇸 Spagna</option>
          <option value="NL">🇳🇱 Paesi Bassi</option>
          <option value="BE">🇧🇪 Belgio</option>
          <option value="CH">🇨🇭 Svizzera</option>
          <option value="AT">🇦🇹 Austria</option>
          <option value="PT">🇵🇹 Portogallo</option>
          <option value="PL">🇵🇱 Polonia</option>
          <option value="SE">🇸🇪 Svezia</option>
          <option value="NO">🇳🇴 Norvegia</option>
          <option value="DK">🇩🇰 Danimarca</option>
          <option value="FI">🇫🇮 Finlandia</option>
          <option value="CZ">🇨🇿 Repubblica Ceca</option>
          <option value="HU">🇭🇺 Ungheria</option>
          <option value="RO">🇷🇴 Romania</option>
          <option value="GR">🇬🇷 Grecia</option>
          <option value="HR">🇭🇷 Croazia</option>
          <option value="RU">🇷🇺 Russia</option>
          <option value="CN">🇨🇳 Cina</option>
          <option value="JP">🇯🇵 Giappone</option>
          <option value="KR">🇰🇷 Corea del Sud</option>
          <option value="IN">🇮🇳 India</option>
          <option value="AU">🇦🇺 Australia</option>
          <option value="CA">🇨🇦 Canada</option>
          <option value="BR">🇧🇷 Brasile</option>
          <option value="MX">🇲🇽 Messico</option>
          <option value="AR">🇦🇷 Argentina</option>
          <option value="ZA">🇿🇦 Sudafrica</option>
          <option value="IL">🇮🇱 Israele</option>
          <option value="TR">🇹🇷 Turchia</option>
          <option value="AE">🇦🇪 Emirati Arabi</option>
          <option value="OTHER">Altro</option>
        </select>
      </div>
      <div class="consents">
        <label class="consent-row">
          <input type="checkbox" name="consents" value="TERMS_OF_SERVICE" required/>
          <span>Accetto i <a href="/legal/terms" target="_blank">Termini di servizio</a> *</span>
        </label>
        <label class="consent-row">
          <input type="checkbox" name="consents" value="MARKETING_EMAIL"/>
          <span>Desidero ricevere offerte via email</span>
        </label>
      </div>
      {profiling_section}
      <button type="submit" class="btn-primary">Connettiti con email &rarr;</button>
    </form>
    """


    pc = esc(d.get("primary_color", "#0055ff"))
    ac = esc(d.get("accent_color", "#f5f5f5"))
    bg_img = d.get("background_image_url")
    bg_style = (
        f"background:url('{esc(bg_img)}') center/cover no-repeat fixed;background-color:{ac};"
        if bg_img else f"background:{ac};"
    )
    overlay_css = (
        "body::before{content:'';position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:0;}"
        if bg_img else ""
    )

    hero = f'<img src="{esc(d.get("hero_image_url"))}" class="hero-img" alt=""/>' if d.get("hero_image_url") else ""
    logo = (
        f'<div class="logo-wrap"><img src="{esc(d.get("logo_url"))}" alt="{esc(d.get("tenant_name"))} logo"/></div>'
        if d.get("logo_url") else ""
    )

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="robots" content="noindex"/>
  <title>WiFi {esc(d.get('site_name'))}</title>
  <style>
    *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;{bg_style}min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}}
    {overlay_css}
    .card{{background:#fff;border-radius:16px;overflow:hidden;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.18);position:relative;z-index:1}}
    .card-body{{padding:32px 32px 36px}}
    .hero-img{{width:100%;height:160px;object-fit:cover;display:block}}
    .logo-wrap{{text-align:center;margin-bottom:20px}}
    .logo-wrap img{{max-height:64px;max-width:180px;object-fit:contain}}
    .welcome-title{{font-size:1.4rem;font-weight:700;color:#111;text-align:center;margin-bottom:6px}}
    .welcome-text{{font-size:.92rem;color:#555;text-align:center;margin-bottom:24px;line-height:1.5}}
    .field{{margin-bottom:12px}}
    .field input,.field select{{width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:.95rem;outline:none;background:#fff;color:#111;appearance:none;-webkit-appearance:none}}
    .field input:focus,.field select:focus{{border-color:{pc}}}
    .field select{{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}}
    .consents{{margin:14px 0 18px}}
    .consent-row{{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;cursor:pointer}}
    .consent-row input[type=checkbox]{{margin-top:2px;accent-color:{pc};flex-shrink:0}}
    .consent-row span{{font-size:.83rem;color:#444;line-height:1.4}}
    .consent-row a{{color:{pc};text-decoration:none}}
    .btn-primary{{width:100%;padding:13px;background:{pc};color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer}}
    .divider{{display:flex;align-items:center;gap:10px;margin:18px 0;color:#bbb;font-size:.82rem}}
    .divider::before,.divider::after{{content:'';flex:1;height:1px;background:#e5e5e5}}
    .profiling-divider{{display:flex;align-items:center;gap:10px;margin:20px 0 14px;color:#888;font-size:.8rem;font-style:italic}}
    .profiling-divider::before,.profiling-divider::after{{content:'';flex:1;height:1px;background:#ececec}}
    .powered-by{{text-align:center;margin-top:24px;font-size:.75rem;color:#ccc}}
  </style>
</head>
<body>
  <div class="card">
    {hero}
    <div class="card-body">
      {logo}
      <h1 class="welcome-title">{esc(d.get('welcome_title', 'Benvenuto!'))}</h1>
      <p class="welcome-text">{esc(d.get('welcome_text', 'Connettiti al WiFi gratuito.'))}</p>
      {email_form}
      <p class="powered-by">WiFi powered by Authwifi</p>
    </div>
  </div>
</body>
</html>"""
