import os
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

GLOBAL_SMTP_HOST       = os.getenv("SMTP_HOST", "")
GLOBAL_SMTP_PORT       = int(os.getenv("SMTP_PORT", "587"))
GLOBAL_SMTP_SECURITY   = os.getenv("SMTP_SECURITY", "starttls")
GLOBAL_SMTP_USERNAME   = os.getenv("SMTP_USERNAME", "")
GLOBAL_SMTP_PASSWORD   = os.getenv("SMTP_PASSWORD", "")
GLOBAL_SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@authwifi.it")
GLOBAL_SMTP_FROM_NAME  = os.getenv("SMTP_FROM_NAME", "Authwifi")
BASE_URL               = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")

_SCORE_BG = ["#fee2e2","#fee2e2","#fef3c7","#fef3c7","#fef3c7",
             "#fef3c7","#fef3c7","#dcfce7","#dcfce7","#dcfce7","#dcfce7"]
_SCORE_FG = ["#dc2626","#dc2626","#b45309","#b45309","#b45309",
             "#b45309","#b45309","#15803d","#15803d","#15803d","#15803d"]

_HTML = (
    '<!DOCTYPE html>'
    '<html lang="it">'
    '<head>'
    '<meta charset="UTF-8"/>'
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>'
    '<meta name="color-scheme" content="light"/>'
    '<meta name="supported-color-schemes" content="light"/>'
    '<style>'
    'body{margin:0;padding:0;background:#eef2f7;'
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;'
    '-webkit-font-smoothing:antialiased}'
    '@media only screen and (max-width:600px){'
    '.ew{padding:16px 8px!important}'
    '.ec{border-radius:12px!important;box-shadow:none!important}'
    '.eh,.eb,.ef{padding-left:20px!important;padding-right:20px!important}'
    '.eb{padding-top:24px!important}'
    '}'
    '</style>'
    '</head>'
    '<body>'
    '<div style="display:none;max-height:0;overflow:hidden;color:#eef2f7;font-size:1px">'
    'Valuta la tua esperienza in 30 secondi &#8203;&#8203;&#8203;&#8203;</div>'
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ew"'
    ' style="background:#eef2f7;padding:40px 16px">'
    '<tr><td align="center">'
    '<table role="presentation" class="ec" cellpadding="0" cellspacing="0"'
    ' style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;'
    'overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.10)">'
    '__HEADER__'
    '<tr><td class="eb" style="padding:36px 40px 0">'
    '<h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#111;line-height:1.3;text-align:center">'
    'Ciao __NAME__,</h1>'
    '<p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.65;text-align:center">__BODY__</p>'
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    ' style="background:#f7f8fa;border-radius:12px;padding:18px 18px 12px;margin-bottom:28px">'
    '<tr><td>'
    '<p style="margin:0 0 10px;font-size:10px;font-weight:600;color:#aaa;'
    'text-transform:uppercase;letter-spacing:.8px;text-align:center">Da 0 a 10, quanto ci consiglieresti?</p>'
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>__SCORES__</tr></table>'
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:7px">'
    '<tr><td style="font-size:10px;color:#bbb">Per niente</td>'
    '<td align="right" style="font-size:10px;color:#bbb">Assolutamente</td></tr>'
    '</table>'
    '</td></tr></table>'
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    ' style="margin-bottom:36px"><tr><td align="center">'
    '<a href="__URL__"'
    ' style="display:inline-block;background:__PRIMARY__;color:#fff;text-decoration:none;'
    'padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:-.2px">'
    '__BTN__</a>'
    '</td></tr></table>'
    '</td></tr>'
    '<tr><td class="ef" style="padding:18px 40px 26px;border-top:1px solid #f0f0f0;text-align:center">'
    '<p style="margin:0;font-size:11px;color:#bbb;line-height:1.7">'
    '__FOOTER__<br/>'
    '<a href="https://authwifi.it" style="color:#ccc;text-decoration:none">Powered by Authwifi</a>'
    '</p></td></tr>'
    '</table></td></tr></table>'
    '</body></html>'
)


def _scores() -> str:
    return "".join(
        f'<td style="padding:2px"><div style="width:30px;height:30px;'
        f'background:{_SCORE_BG[i]};border-radius:6px;text-align:center;'
        f'line-height:30px;font-size:12px;font-weight:700;color:{_SCORE_FG[i]}">'
        f'{i}</div></td>'
        for i in range(11)
    )


def _build_survey_html(
    to_name: str,
    survey_url: str,
    site_name: str,
    logo_url: str | None = None,
    primary_color: str = "#0055ff",
    body_text: str | None = None,
    button_text: str | None = None,
    footer_text: str | None = None,
) -> str:
    name = to_name or "Ospite"
    sn   = site_name or ""

    def t(val, default):
        return (val or default).replace("{nome_sito}", sn).replace("{nome_ospite}", name)

    body   = t(body_text,   f"Grazie per aver visitato <strong>{sn}</strong>."
                             " Ci piacerebbe sapere come è stata la tua esperienza — bastano 30 secondi.")
    btn    = t(button_text, "Lascia la tua valutazione")
    footer = t(footer_text, f"Hai ricevuto questa email perché ti sei connesso al WiFi di {sn}.")

    sn_safe = sn.replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')

    if logo_url:
        abs_logo = (BASE_URL + logo_url) if logo_url.startswith("/") else logo_url
        header = (
            '<tr><td class="eh" style="background:#ffffff;padding:24px 40px;'
            'text-align:center;border-bottom:1px solid #f0f0f0">'
            f'<img src="{abs_logo}" alt="{sn_safe}"'
            ' style="max-height:60px;max-width:200px;object-fit:contain"/>'
            '</td></tr>'
        )
    else:
        header = (
            f'<tr><td class="eh" style="background:{primary_color};padding:28px 40px;'
            'text-align:center">'
            f'<span style="font-size:1.2rem;font-weight:700;color:#fff;letter-spacing:-.4px">'
            f'{sn_safe}</span>'
            '</td></tr>'
        )

    return (
        _HTML
        .replace("__HEADER__",  header)
        .replace("__NAME__",    name)
        .replace("__BODY__",    body)
        .replace("__SCORES__",  _scores())
        .replace("__URL__",     survey_url)
        .replace("__PRIMARY__", primary_color)
        .replace("__BTN__",     btn)
        .replace("__FOOTER__",  footer)
    )


def send_survey_email(
    to_email: str,
    to_name: str,
    survey_url: str,
    site_name: str,
    smtp_config: dict | None = None,
    site_branding: dict | None = None,
    email_config: dict | None = None,
) -> bool:
    br  = site_branding or {}
    ec  = email_config  or {}

    html = _build_survey_html(
        to_name, survey_url, site_name,
        logo_url      = br.get("logo_url"),
        primary_color = br.get("primary_color", "#0055ff"),
        body_text     = ec.get("body_text"),
        button_text   = ec.get("button_text"),
        footer_text   = ec.get("footer_text"),
    )

    cfg        = smtp_config or {}
    host       = cfg.get("host")       or GLOBAL_SMTP_HOST
    port       = cfg.get("port")       or GLOBAL_SMTP_PORT
    security   = cfg.get("security")   or GLOBAL_SMTP_SECURITY
    username   = cfg.get("username")   or GLOBAL_SMTP_USERNAME
    password   = cfg.get("password")   or GLOBAL_SMTP_PASSWORD
    from_email = cfg.get("from_email") or GLOBAL_SMTP_FROM_EMAIL
    from_name  = cfg.get("from_name")  or GLOBAL_SMTP_FROM_NAME

    if not host:
        logger.warning("[EMAIL MOCK] Survey a %s | URL: %s", to_email, survey_url)
        return True

    subj = (ec.get("subject") or f"Come è stata la tua esperienza da {site_name}?")
    subj = subj.replace("{nome_sito}", site_name)

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subj
        msg["From"]    = f"{from_name} <{from_email}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html, "html", "utf-8"))

        if security == "ssl":
            with smtplib.SMTP_SSL(host, int(port), timeout=15) as s:
                if username and password: s.login(username, password)
                s.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, int(port), timeout=15) as s:
                if security == "starttls": s.starttls()
                if username and password: s.login(username, password)
                s.sendmail(from_email, [to_email], msg.as_string())

        logger.info("Email inviata a %s via %s:%s (%s)", to_email, host, port, security)
        return True
    except Exception as exc:
        logger.error("Errore invio email a %s: %s", to_email, exc)
        return False
