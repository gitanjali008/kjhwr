from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import main
from app.elexon import Actual, Forecast

T0 = datetime(2026, 1, 10, 12, tzinfo=timezone.utc)


@pytest.fixture
def client(monkeypatch):
    actuals = [Actual(T0, 900), Actual(T0 + timedelta(minutes=30), 950)]
    forecasts = [Forecast(T0, T0 - timedelta(hours=30), 1000)]
    monkeypatch.setattr(main.repository, "_data", (actuals, forecasts))
    monkeypatch.setattr(main.repository, "source", "test")
    main._index.cache_clear()
    yield TestClient(main.app)
    main._index.cache_clear()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "source": "test", "actuals": 2, "forecasts": 1}


def test_series(client):
    rows = client.get("/api/series", params={"horizon": 24}).json()
    assert len(rows) == 2
    assert rows[0]["forecast"] == 1000 and rows[0]["error"] == 100


def test_metrics(client):
    body = client.get("/api/metrics", params={"mode": "dayahead"}).json()
    assert body["overall"]["count"] == 1
    assert body["overall"]["mae"] == 100
    assert len(body["by_hour_of_day"]) == 24


def test_metrics_by_horizon(client):
    rows = client.get("/api/metrics/horizons", params={"step": 12}).json()
    assert [r["horizon_hours"] for r in rows] == [0, 12, 24, 36, 48]


@pytest.mark.parametrize(
    "params",
    [{"horizon": 99}, {"mode": "bogus"}, {"start": "2026-01-05T00:00:00Z", "end": "2026-01-01T00:00:00Z"}],
)
def test_invalid_params_rejected(client, params):
    assert client.get("/api/series", params=params).status_code == 422
