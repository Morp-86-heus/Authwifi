import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
PLACES_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def _make_external_id(author: str, ts: int) -> str:
    return hashlib.sha256(f"{author}:{ts}".encode()).hexdigest()[:24]


def fetch_google_reviews(place_id: str) -> Optional[list[dict]]:
    if not PLACES_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY non impostata — sync saltata")
        return None

    try:
        resp = httpx.get(
            PLACES_URL,
            params={
                "place_id": place_id,
                "fields": "reviews,rating,user_ratings_total",
                "language": "it",
                "key": PLACES_API_KEY,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "OK":
            logger.error("Places API error: %s — %s", data.get("status"), data.get("error_message"))
            return None

        result = data.get("result", {})
        reviews_raw = result.get("reviews", [])

        reviews = []
        for r in reviews_raw:
            ts = r.get("time", 0)
            author = r.get("author_name", "")
            reviews.append({
                "external_id": _make_external_id(author, ts),
                "author_name": author,
                "author_photo": r.get("profile_photo_url"),
                "rating": r.get("rating"),
                "text": r.get("text", "").strip() or None,
                "published_at": datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None) if ts else None,
            })

        return reviews

    except Exception as exc:
        logger.error("Errore fetch Google reviews per %s: %s", place_id, exc)
        return None
