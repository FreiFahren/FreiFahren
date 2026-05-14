import logging

import httpx

logger = logging.getLogger(__name__)


class ReportClient:
    def __init__(self, *, backend_url: str, report_password: str) -> None:
        self._client = httpx.AsyncClient(base_url=backend_url, timeout=15.0)
        self._headers = {"X-Password": report_password}

    async def submit(
        self,
        *,
        station_id: str,
        line_id: str | None,
        direction_id: str | None,
    ) -> bool:
        payload: dict[str, object] = {
            "stationId": station_id,
            "source": "telegram",
        }
        if line_id is not None:
            payload["lineId"] = line_id
        if direction_id is not None:
            payload["directionId"] = direction_id

        try:
            response = await self._client.post("/v0/reports", json=payload, headers=self._headers)
        except httpx.HTTPError:
            logger.exception("POST /v0/reports failed")
            return False

        if response.is_success:
            return True

        logger.error("POST /v0/reports returned %s: %s", response.status_code, response.text)
        return False

    async def aclose(self) -> None:
        await self._client.aclose()
