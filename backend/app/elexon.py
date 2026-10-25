"""Data access layer for the Elexon BMRS API.

Fetches wind actuals (FUELHH, fuelType=WIND) and wind forecasts (WINDFOR),
normalises them into plain dataclasses, and caches them in memory. If the
live API is unavailable, a bundled JSON snapshot is used instead.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

import httpx

from . import config

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Actual:
    start_time: datetime
    generation: float  # MW


@dataclass(frozen=True)
class Forecast:
    start_time: datetime
    publish_time: datetime
    generation: float  # MW


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _get(client: httpx.Client, path: str, params: dict) -> list[dict]:
    resp = client.get(f"{config.ELEXON_BASE_URL}{path}", params=params)
    resp.raise_for_status()
    return resp.json()


def fetch_actuals(client: httpx.Client) -> list[Actual]:
    last_day = config.WINDOW_END - timedelta(days=1)
    rows = _get(
        client,
        "/datasets/FUELHH/stream",
        {
            "settlementDateFrom": config.WINDOW_START.date().isoformat(),
            "settlementDateTo": last_day.date().isoformat(),
            "fuelType": "WIND",
        },
    )
    actuals = {}
    for r in rows:
        if r.get("fuelType") != "WIND" or r.get("generation") is None:
            continue
        ts = parse_ts(r["startTime"])
        if config.WINDOW_START <= ts < config.WINDOW_END:
            actuals[ts] = Actual(ts, float(r["generation"]))  # de-duplicate by startTime
    return sorted(actuals.values(), key=lambda a: a.start_time)


def fetch_forecasts(client: httpx.Client) -> list[Forecast]:
    publish_from = config.WINDOW_START - timedelta(days=config.FORECAST_PUBLISH_LOOKBACK_DAYS)
    rows = _get(
        client,
        "/datasets/WINDFOR/stream",
        {"publishDateTimeFrom": _iso(publish_from), "publishDateTimeTo": _iso(config.WINDOW_END)},
    )
    forecasts = []
    for r in rows:
        if r.get("generation") is None:
            continue
        start, publish = parse_ts(r["startTime"]), parse_ts(r["publishTime"])
        horizon_h = (start - publish).total_seconds() / 3600
        # Keep genuine forecasts only (target in the future, within WINDFOR's range)
        # and only for targets inside our delivery window.
        if 0 <= horizon_h <= config.FORECAST_MAX_LEAD_HOURS and config.WINDOW_START <= start < config.WINDOW_END:
            forecasts.append(Forecast(start, publish, float(r["generation"])))
    return forecasts


# ---------------------------------------------------------------------------
# Snapshot (offline fallback) helpers
# ---------------------------------------------------------------------------

def _snapshot_path(name: str) -> str:
    return os.path.join(config.SNAPSHOT_DIR, f"{name}.json")


def save_snapshot(actuals: list[Actual], forecasts: list[Forecast]) -> None:
    os.makedirs(config.SNAPSHOT_DIR, exist_ok=True)

    def dump(items):
        return [{k: _iso(v) if isinstance(v, datetime) else v for k, v in asdict(i).items()} for i in items]

    with open(_snapshot_path("actuals"), "w") as f:
        json.dump(dump(actuals), f)
    with open(_snapshot_path("forecasts"), "w") as f:
        json.dump(dump(forecasts), f)


def load_snapshot() -> tuple[list[Actual], list[Forecast]]:
    with open(_snapshot_path("actuals")) as f:
        actuals = [Actual(parse_ts(r["start_time"]), r["generation"]) for r in json.load(f)]
    with open(_snapshot_path("forecasts")) as f:
        forecasts = [
            Forecast(parse_ts(r["start_time"]), parse_ts(r["publish_time"]), r["generation"])
            for r in json.load(f)
        ]
    return actuals, forecasts


# ---------------------------------------------------------------------------
# Cached repository used by the API layer
# ---------------------------------------------------------------------------

class WindDataRepository:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: tuple[list[Actual], list[Forecast]] | None = None
        self.source = "none"

    def get(self) -> tuple[list[Actual], list[Forecast]]:
        with self._lock:
            if self._data is None:
                self._data = self._load()
            return self._data

    def _load(self) -> tuple[list[Actual], list[Forecast]]:
        if config.DATA_SOURCE == "snapshot":
            self.source = "snapshot"
            return load_snapshot()
        try:
            with httpx.Client(timeout=config.HTTP_TIMEOUT_SECONDS) as client:
                data = fetch_actuals(client), fetch_forecasts(client)
            self.source = "elexon-live"
            log.info("Loaded %d actuals and %d forecasts from Elexon", len(data[0]), len(data[1]))
            return data
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("Elexon API unavailable (%s); falling back to snapshot", exc)
            self.source = "snapshot"
            return load_snapshot()


repository = WindDataRepository()
