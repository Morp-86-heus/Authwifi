"""
Survey scheduler — gira in loop ogni CHECK_INTERVAL_SECONDS.
Trova gli ospiti la cui ultima sessione WiFi è avvenuta almeno
`survey_hours_delay` ore fa, non hanno ancora ricevuto la survey,
e il sito ha la survey abilitata. Pubblica un messaggio su RabbitMQ
e marca subito survey_email_sent_at per evitare invii doppi.
"""
import logging
import os
import sys
import time

sys.path.insert(0, "/app")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from services.rabbitmq import publish_survey

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [scheduler] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://authwifi:authwifi@postgres:9999/authwifi")
CHECK_INTERVAL_SECONDS = int(os.getenv("SCHEDULER_INTERVAL_SECONDS", "3600"))  # ogni ora

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Trova ospiti con almeno un'email, survey non ancora inviata,
# la cui ULTIMA sessione risale ad almeno survey_hours_delay ore fa
# (finestra di 48h per non notificare ospiti molto vecchi)
QUERY = text("""
    SELECT
        g.id              AS guest_id,
        g.email           AS email,
        g."firstName"     AS first_name,
        g."tenantId"      AS tenant_id,
        last_s."siteId"   AS site_id,
        s.name            AS site_name,
        last_s."startedAt" AS last_session
    FROM guests g
    INNER JOIN LATERAL (
        SELECT ws."siteId", ws."startedAt"
        FROM wifi_sessions ws
        WHERE ws."guestId" = g.id
        ORDER BY ws."startedAt" DESC
        LIMIT 1
    ) last_s ON true
    INNER JOIN sites s ON s.id = last_s."siteId"
    INNER JOIN tenants t ON t.id = g."tenantId"
    WHERE g.email IS NOT NULL
      AND g."surveyEmailSentAt" IS NULL
      AND g."deletedAt" IS NULL
      AND t."isSuspended" = false
      AND s."surveyEnabled" = true
      AND last_s."startedAt" < NOW() - (s."surveyHoursDelay" * INTERVAL '1 hour')
      AND last_s."startedAt" > NOW() - (s."surveyHoursDelay" * INTERVAL '1 hour') - INTERVAL '48 hours'
""")

MARK_SENT = text("""
    UPDATE guests SET "surveyEmailSentAt" = NOW() WHERE id = :guest_id
""")


def run_once():
    with Session(engine) as db:
        rows = db.execute(QUERY).mappings().all()
        if not rows:
            logger.info("Nessun ospite da notificare.")
            return

        logger.info("%d ospiti da notificare.", len(rows))
        published = 0
        for row in rows:
            try:
                publish_survey({
                    "guest_id":  row["guest_id"],
                    "email":     row["email"],
                    "first_name": row["first_name"] or "",
                    "tenant_id": row["tenant_id"],
                    "site_id":   row["site_id"],
                    "site_name": row["site_name"],
                })
                db.execute(MARK_SENT, {"guest_id": row["guest_id"]})
                published += 1
            except Exception as exc:
                logger.error("Errore pubblicazione per guest %s: %s", row["guest_id"], exc)

        db.commit()
        logger.info("%d messaggi pubblicati su RabbitMQ.", published)


def main():
    logger.info("Survey scheduler avviato (intervallo %ds).", CHECK_INTERVAL_SECONDS)
    while True:
        try:
            run_once()
        except Exception as exc:
            logger.error("Errore nel ciclo scheduler: %s", exc)
        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
