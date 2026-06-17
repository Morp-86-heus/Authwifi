"""
Campaign sender worker.
Ogni POLL_INTERVAL secondi cerca destinatari pending e invia le email.
"""
import json
import logging
import os
import sys
import time

sys.path.insert(0, "/app")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from models import Campaign, CampaignRecipient, Site, Guest, new_id
from services.email import send_html_email
from services.email_builder import blocks_to_plaintext
from services.email_builder import blocks_to_html

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [campaign_sender] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL  = os.getenv("DATABASE_URL", "postgresql://authwifi:authwifi@postgres:9999/authwifi")
POLL_INTERVAL = int(os.getenv("CAMPAIGN_POLL_INTERVAL", "30"))

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def _send_one(db: Session, recipient: CampaignRecipient, campaign: Campaign, site: Site | None) -> bool:
    blocks   = json.loads(campaign.blocks) if campaign.blocks else []
    logo_url = site.logo_url if site else None
    primary  = (site.primary_color if site else None) or "#0055ff"
    name     = site.name if site else ""
    footer   = (site.smtp_from_name if site else None) or name or ""

    html_body = blocks_to_html(
        blocks,
        logo_url=logo_url,
        primary_color=primary,
        site_name=name,
        footer_text=footer,
    )

    smtp_config = None
    if site and site.smtp_host:
        smtp_config = {
            "host":       site.smtp_host,
            "port":       site.smtp_port,
            "security":   site.smtp_security,
            "username":   site.smtp_username,
            "password":   site.smtp_password,
            "from_email": site.smtp_from_email,
            "from_name":  site.smtp_from_name,
        }

    # Recupera nome ospite
    guest_name = ""
    if recipient.guest_id:
        g = db.query(Guest).filter(Guest.id == recipient.guest_id).first()
        if g:
            guest_name = g.first_name or ""

    try:
        plain = blocks_to_plaintext(blocks, site_name=name)
        ok = send_html_email(
            recipient.email,
            campaign.subject or ("Messaggio da " + name) if name else "Nuovo messaggio",
            html_body,
            smtp_config,
            plain_text=plain,
        )
        return ok
    except Exception as exc:
        logger.error("Errore invio a %s: %s", recipient.email, exc)
        return False


def process_batch():
    with Session(engine) as db:
        # Prendi batch di pending
        recipients = (
            db.query(CampaignRecipient)
            .filter(CampaignRecipient.status == "pending")
            .limit(50)
            .all()
        )
        if not recipients:
            return

        campaign_cache: dict[str, Campaign] = {}
        site_cache: dict[str | None, Site | None] = {}

        from datetime import datetime, timezone

        for r in recipients:
            if r.campaign_id not in campaign_cache:
                campaign_cache[r.campaign_id] = db.query(Campaign).filter(
                    Campaign.id == r.campaign_id
                ).first()
            campaign = campaign_cache[r.campaign_id]
            if not campaign:
                r.status = "failed"
                r.failed_reason = "Campaign not found"
                db.commit()
                continue

            if campaign.site_id not in site_cache:
                site_cache[campaign.site_id] = (
                    db.query(Site).filter(Site.id == campaign.site_id).first()
                    if campaign.site_id else None
                )
            site = site_cache[campaign.site_id]

            ok = _send_one(db, r, campaign, site)
            now = datetime.now(timezone.utc)
            if ok:
                r.status = "sent"
                r.sent_at = now
                campaign.sent_count = (campaign.sent_count or 0) + 1
            else:
                r.status = "failed"
                r.failed_reason = "SMTP error"
                campaign.failed_count = (campaign.failed_count or 0) + 1

            # Aggiorna stato campagna se completata
            total_done = (campaign.sent_count or 0) + (campaign.failed_count or 0)
            if total_done >= (campaign.total_recipients or 0) and campaign.total_recipients > 0:
                campaign.status = "sent"
                campaign.sent_at = now

            db.commit()
            logger.info("Recipient %s -> %s", r.email, r.status)


def main():
    logger.info("Campaign sender avviato (poll ogni %ss)", POLL_INTERVAL)
    while True:
        try:
            process_batch()
        except Exception as exc:
            logger.error("Errore nel batch: %s", exc)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
