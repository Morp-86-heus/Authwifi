import os
import logging
import time
import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(connect=5.0, read=15.0, write=10.0, pool=5.0)


class OmadaClient:
    def __init__(self):
        self._session_cache: dict = {}
        verify_ssl = os.getenv("NODE_ENV") == "production"
        self._http = httpx.AsyncClient(verify=verify_ssl, timeout=_TIMEOUT)

    async def get_session(
        self,
        controller_url: str,
        omadac_id: str,
        username: str,
        password: str,
    ) -> dict:
        cache_key = f"{controller_url}::{username}"
        cached = self._session_cache.get(cache_key)
        if cached and cached["expires_at"] > time.time():
            return cached

        login_url = f"{controller_url}/{omadac_id}/api/v2/hotspot/login"
        logger.info(f"OmadaClient: login operator → {login_url}")

        response = await self._http.post(
            login_url,
            json={"name": username, "password": password},
        )
        response.raise_for_status()
        data = response.json()

        if data.get("errorCode") != 0:
            raise RuntimeError(f"Omada login failed: {data}")

        csrf_token = data.get("result", {}).get("token", "")
        cookies = "; ".join(f"{k}={v}" for k, v in response.cookies.items())

        session = {
            "csrf_token": csrf_token,
            "cookie": cookies,
            "expires_at": time.time() + 8 * 3600,
        }
        self._session_cache[cache_key] = session
        return session

    async def authorize_client(
        self,
        controller_url: str,
        omadac_id: str,
        site_id: str,
        operator_user: str,
        operator_pass: str,
        client_mac: str,
        ap_mac: str,
        ssid_name: str,
        radio_id: str = "0",
        duration_ms: int = 8 * 3600 * 1000,
    ) -> None:
        session = await self.get_session(
            controller_url, omadac_id, operator_user, operator_pass
        )

        auth_url = f"{controller_url}/{omadac_id}/api/v2/hotspot/extPortal/auth"
        logger.info(f"OmadaClient: authorize client {client_mac} on site {site_id}")

        payload = {
            "clientMac": client_mac,
            "apMac": ap_mac,
            "ssidName": ssid_name,
            "radioId": radio_id,
            "site": site_id,
            "time": duration_ms,
            "authType": 4,
        }

        response = await self._http.post(
            auth_url,
            json=payload,
            headers={
                "Csrf-Token": session["csrf_token"],
                "Cookie": session["cookie"],
            },
        )
        response.raise_for_status()
        data = response.json()

        if data.get("errorCode") != 0:
            raise RuntimeError(f"Omada auth failed: {data}")

        logger.info(f"OmadaClient: client {client_mac} authorized")
