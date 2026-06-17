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


def _build_survey_html(
    to_name: str,
    survey_url: str,
    site_name: str,
    logo_url: str | None = None,
    primary_color: str = "#0055ff",
) -> str:
    name_display = to_name or "Ospite"

    # Header: logo img se disponibile, altrimenti nome sito come testo
    if logo_url:
        header_content = (
            f'<img src="{logo_url}" alt="{site_name}"'
            f' style="max-height:60px;max-width:200px;object-fit:contain"/>'
        )
        header_bg = "#ffffff"
        header_padding = "24px 40px"
    else:
        header_content = (
            f'<span style="font-size:1.3rem;font-weight:700;color:#fff;'
            f'letter-spacing:-0.5px">{site_name}</span>'
        )
        header_bg = primary_color
        header_padding = "28px 40px"

    return f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Come è stata la tua esperienza?</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:{header_bg};padding:{header_padding};text-align:center;border-bottom:1px solid #f0f0f0">
          {header_content}
        </td></tr>
        <tr><td style="padding:40px 40px 32px">
          <h1 style="margin:0 0 12px;font-size:1.4rem;font-weight:700;color:#111">Ciao {name_display},</h1>
          <p style="margin:0 0 24px;font-size:.95rem;color:#555;line-height:1.6">
            Grazie per aver visitato <strong>{site_name}</strong>.<br/>
            Ci piacerebbe sapere come è stata la tua esperienza — bastano 30 secondi.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="{survey_url}"
               style="display:inline-block;background:{primary_color};color:#fff;text-decoration:none;
                      padding:14px 36px;border-radius:8px;font-size:1rem;font-weight:600">
              Lascia la tua valutazione
            </a>
          </div>
          <p style="margin:0;font-size:.8rem;color:#aaa;text-align:center">
            Se il bottone non funziona, copia questo link nel browser:<br/>
            <a href="{survey_url}" style="color:{primary_color};word-break:break-all">{survey_url}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 40px 32px;text-align:center;border-top:1px solid #f0f0f0">
          <p style="margin:0;font-size:.75rem;color:#ccc">
            Hai ricevuto questa email perché ti sei connesso al WiFi di {site_name}.<br/>
            Powered by <a href="https://authwifi.it" style="color:#ccc">Authwifi</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_survey_email(
    to_email: str,
    to_name: str,
    survey_url: str,
    site_name: str,
    smtp_config: dict | None = None,
    site_branding: dict | None = None,
) -> bool:
    branding = site_branding or {}
    html = _build_survey_html(
        to_name, survey_url, site_name,
        logo_url=branding.get("logo_url"),
        primary_color=branding.get("primary_color", "#0055ff"),
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
        logger.warning(
            "[EMAIL MOCK] Survey a %s | URL: %s | Nessun server SMTP configurato",
            to_email, survey_url,
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Come è stata la tua esperienza da {site_name}?"
        msg["From"]    = f"{from_name} <{from_email}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html, "html", "utf-8"))

        if security == "ssl":
            with smtplib.SMTP_SSL(host, int(port), timeout=15) as s:
                if username and password:
                    s.login(username, password)
                s.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, int(port), timeout=15) as s:
                if security == "starttls":
                    s.starttls()
                if username and password:
                    s.login(username, password)
                s.sendmail(from_email, [to_email], msg.as_string())

        logger.info("Email inviata a %s via %s:%s (%s)", to_email, host, port, security)
        return True
    except Exception as exc:
        logger.error("Errore invio email a %s: %s", to_email, exc)
        return False
