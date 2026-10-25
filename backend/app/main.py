"""FastAPI application exposing wind actuals, forecasts and forecast-error analytics."""
from __future__ import annotations

import logging
from datetime import datetime
from functools import lru_cache
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import analysis, config
from .elexon import repository

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Wind Forecast Insight API",
    description="UK national wind generation: actuals vs. forecasts for day-ahead purchasing (Jan 2026).",
    version="1.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])

Mode = Literal["horizon", "dayahead"]


@lru_cache(maxsize=1)
def _index() -> analysis.ForecastIndex:
    return analysis.ForecastIndex(repository.get()[1])


def _actuals():
    return repository.get()[0]


def _selector(mode: Mode, horizon: float) -> analysis.Selector:
    if mode == "dayahead":
        return analysis.day_ahead_selector(_index(), config.DAY_AHEAD_CUTOFF_HOUR_UTC)
    return analysis.fixed_horizon_selector(_index(), horizon)


def _window(start: Optional[datetime], end: Optional[datetime]) -> tuple[datetime, datetime]:
    start = start or config.WINDOW_START
    end = end or config.WINDOW_END
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "start and end must include a timezone, e.g. 2026-01-05T00:00:00Z")
    if start >= end:
        raise HTTPException(422, "start must be before end")
    return start, end


def _series(mode: Mode, horizon: float, start, end) -> list[analysis.Point]:
    start, end = _window(start, end)
    return analysis.build_series(_actuals(), _index(), _selector(mode, horizon), start, end)


ModeQ = Query("horizon", description="'horizon' = fixed lead time; 'dayahead' = forecast available at D-1 cutoff")
HorizonQ = Query(24, ge=0, le=config.MAX_HORIZON_HOURS, description="Minimum forecast lead time in hours")
StartQ = Query(None, description="Inclusive UTC start, ISO-8601")
EndQ = Query(None, description="Exclusive UTC end, ISO-8601")


@app.get("/api/health")
def health():
    actuals, forecasts = repository.get()
    return {"status": "ok", "source": repository.source, "actuals": len(actuals), "forecasts": len(forecasts)}


@app.get("/api/meta")
def meta():
    return {
        "window_start": config.WINDOW_START,
        "window_end": config.WINDOW_END,
        "max_horizon_hours": config.MAX_HORIZON_HOURS,
        "day_ahead_cutoff_hour_utc": config.DAY_AHEAD_CUTOFF_HOUR_UTC,
        "error_convention": "error = forecast - actual (MW)",
    }


@app.get("/api/series")
def series(mode: Mode = ModeQ, horizon: float = HorizonQ, start: Optional[datetime] = StartQ, end: Optional[datetime] = EndQ):
    return [
        {
            "time": p.time,
            "actual": p.actual,
            "forecast": p.forecast,
            "publish_time": p.publish_time,
            "horizon_hours": p.horizon_hours,
            "error": p.error,
        }
        for p in _series(mode, horizon, start, end)
    ]


@app.get("/api/metrics")
def metrics(mode: Mode = ModeQ, horizon: float = HorizonQ, start: Optional[datetime] = StartQ, end: Optional[datetime] = EndQ):
    points = _series(mode, horizon, start, end)
    return {
        "overall": analysis.compute_metrics(points),
        "by_hour_of_day": analysis.metrics_by_hour_of_day(points),
        "histogram": analysis.error_histogram(points),
    }


@app.get("/api/metrics/horizons")
def metrics_by_horizon(step: int = Query(1, ge=1, le=12)):
    return analysis.metrics_by_horizon(_actuals(), _index(), range(0, config.MAX_HORIZON_HOURS + 1, step))
