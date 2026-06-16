import os
import logging

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "noreply@authwifi.it")
FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "Authwifi")


def _build_survey_html(to_name: str, survey_url: str, site_name: str) -> str:
    name_display = to_name or "Ospite"
    return f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Come è stata la tua esperienza?</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#0055ff;padding:32px 40px;text-align:center">
          <span style="font-size:1.4rem;font-weight:700;color:#fff;letter-spacing:-0.5px">Authwifi</span>
        </td></tr>
        <tr><td style="padding:40px 40px 32px">
          <h1 style="margin:0 0 12px;font-size:1.4rem;font-weight:700;color:#111">Ciao {name_display},</h1>
          <p style="margin:0 0 24px;font-size:.95rem;color:#555;line-height:1.6">
            Grazie per aver visitato <strong>{site_name}</strong>.<br/>
            Ci piacerebbe sapere come è stata la tua esperienza — bastano 30 secondi.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="{survey_url}"
               style="display:inline-block;background:#0055ff;color:#fff;text-decoration:none;
                      padding:14px 36px;border-radius:8px;font-size:1rem;font-weight:600">
              Lascia la tua valutazione
            </a>
          </div>
          <p style="margin:0;font-size:.8rem;color:#aaa;text-align:center">
            Se il bottone non funziona, copia questo link nel browser:<br/>
            <a href="{survey_url}" style="color:#0055ff;word-break:break-all">{survey_url}</a>
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


def send_survey_email(to_email: str, to_name: str, survey_url: str, site_name: str) -> bool:
    html = _build_survey_html(to_name, survey_url, site_name)

    if not SENDGRID_API_KEY:
        logger.warning(
            "[EMAIL MOCK] Survey a %s | URL: %s | HTML pronto, manca SENDGRID_API_KEY",
            to_email, survey_url,
        )
        return True

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        msg = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=to_email,
            subject=f"Come è stata la tua esperienza da {site_name}?",
            html_content=html,
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(msg)
        logger.info("Email inviata a %s — status %s", to_email, response.status_code)
        return True
    except Exception as exc:
        logger.error("Errore invio email a %s: %s", to_email, exc)
        return False
