import json, os, logging
import redis as _redis_lib

logger = logging.getLogger(__name__)

REDIS_URL  = os.getenv("REDIS_URL", "redis://redis:6379/0")
TTL_SITE   = 300   # 5 min — site meta, segments
TTL_LISTS  = 120   # 2 min — whitelist / blacklist MACs

_client: "_redis_lib.Redis | None" = None


def _r():
    global _client
    if _client is None:
        try:
            _client = _redis_lib.Redis.from_url(
                REDIS_URL, decode_responses=True,
                socket_connect_timeout=2, socket_timeout=2,
            )
            _client.ping()
            logger.info("Redis connesso: %s", REDIS_URL)
        except Exception as exc:
            logger.warning("Redis non disponibile, cache disabilitata: %s", exc)
            _client = None
    return _client


def cache_get(key: str):
    r = _r()
    if r is None:
        return None
    try:
        v = r.get(key)
        return json.loads(v) if v else None
    except Exception:
        return None


def cache_set(key: str, value, ttl: int = TTL_SITE):
    r = _r()
    if r is None:
        return
    try:
        r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass


def cache_delete(*keys: str):
    r = _r()
    if r is None:
        return
    if keys:
        try:
            r.delete(*keys)
        except Exception:
            pass
