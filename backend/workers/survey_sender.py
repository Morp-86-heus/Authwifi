"""
Survey sender — consumer RabbitMQ.
Per ogni messaggio: genera token, crea SurveyResponse pendente nel DB,
invia l'email usando la config SMTP del sito (fallback globale se non configurata).
In caso di errore email il messaggio viene nackato e reinserito in coda.
"""
import json
import logging
import os
import sys

sys.path.insert(0, "/app")

from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from models import Site, SurveyResponse, new_id
from services.email import send_survey_email
from services.rabbitmq import consume_survey
from services.crypto import decrypt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [sender] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://authwifi:authwifi@postgres:9999/authwifi")
JWT_SECRET = os.getenv("JWT_SECRET", "")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def _make_survey_token(guest_id: str, site_id: str, tenant_id: str) -> str:
    return jwt.encode(
        {"type": "survey", "guest_id": guest_id, "site_id": site_id, "tenant_id": tenant_id},
        JWT_SECRET,
        algorithm="HS256",
    )


def _smtp_config_from_site(site: Site) -> dict | None:
    if not site or not site.smtp_host:
        return None
    return {
        "host":       site.smtp_host,
        "port":       site.smtp_port,
        "security":   site.smtp_security,
        "username":   site.smtp_username,
        "password":   decrypt(site.smtp_password),
        "from_email": site.smtp_from_email,
        "from_name":  site.smtp_from_name,
    }


def _branding_from_site(site: Site) -> dict:
    return {
        "logo_url":      site.logo_url,
        "primary_color": site.primary_color or "#0055ff",
    }


def _email_config_from_site(site: Site) -> dict:
    return {
        "subject":     site.email_subject,
        "body_text":   site.email_body_text,
        "button_text": site.email_button_text,
        "footer_text": site.email_footer_text,
    }


def handle_message(ch, method, _props, body):
    try:
        msg = json.loads(body)
    except Exception:
        logger.error("Messaggio non valido: %s", body)
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    guest_id   = msg.get("guest_id")
    site_id    = msg.get("site_id")
    tenant_id  = msg.get("tenant_id")
    email      = msg.get("email")
    first_name = msg.get("first_name", "")
    site_name  = msg.get("site_name", "")

    logger.info("Elaboro survey per guest %s (%s)", guest_id, email)

    token = _make_survey_token(guest_id, site_id, tenant_id)
    survey_url = f"{BASE_URL}/survey/{token}"

    smtp_config = None
    with Session(engine) as db:
        existing = db.query(SurveyResponse).filter(
            SurveyResponse.guest_id == guest_id,
            SurveyResponse.site_id == site_id,
        ).first()
        if existing:
            logger.info("Survey già creata per guest %s — skip.", guest_id)
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        site = db.query(Site).filter(Site.id == site_id).first()
        smtp_config = _smtp_config_from_site(site)
        site_branding = _branding_from_site(site) if site else {}
        email_config  = _email_config_from_site(site) if site else {}

        sr = SurveyResponse(
            id=new_id(),
            guest_id=guest_id,
            site_id=site_id,
            tenant_id=tenant_id,
            survey_token=token,
        )
        db.add(sr)
        db.commit()

    ok = send_survey_email(email, first_name, survey_url, site_name, smtp_config, site_branding, email_config)
    if ok:
        logger.info("Email inviata a %s", email)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    else:
        logger.warning("Invio fallito per %s — nack, verrà riprovato.", email)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


def main():
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET non impostato")
    logger.info("Survey sender avviato — in ascolto su RabbitMQ.")
    consume_survey(handle_message)


if __name__ == "__main__":
    main()
