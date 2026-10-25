from datetime import datetime, timedelta, timezone

import pytest

from app import analysis
from app.elexon import Actual, Forecast

T0 = datetime(2026, 1, 10, 12, tzinfo=timezone.utc)


def h(hours: float) -> timedelta:
    return timedelta(hours=hours)


@pytest.fixture
def index():
    # Three forecasts for the same target, published 30h, 20h and 2h before it.
    return analysis.ForecastIndex(
        [
            Forecast(T0, T0 - h(30), 1000),
            Forecast(T0, T0 - h(20), 1100),
            Forecast(T0, T0 - h(2), 1200),
        ]
    )


@pytest.mark.parametrize("horizon,expected", [(0, 1200), (2, 1200), (3, 1100), (20, 1100), (24, 1000), (30, 1000)])
def test_fixed_horizon_picks_latest_forecast_old_enough(index, horizon, expected):
    assert analysis.fixed_horizon_selector(index, horizon)(T0).generation == expected


def test_fixed_horizon_returns_none_when_no_forecast_old_enough(index):
    assert analysis.fixed_horizon_selector(index, 31)(T0) is None


def test_day_ahead_uses_forecast_available_at_previous_day_cutoff(index):
    # Target is 10 Jan 12:00; cutoff is 9 Jan 11:00 -> only the forecast published 9 Jan 06:00 (T0-30h) qualifies.
    assert analysis.day_ahead_selector(index, 11)(T0).generation == 1000


def test_build_series_pairs_and_computes_error(index):
    actuals = [Actual(T0, 900), Actual(T0 + h(0.5), 950)]
    points = analysis.build_series(actuals, index, analysis.fixed_horizon_selector(index, 24))
    assert [p.time for p in points] == [T0, T0 + h(0.5)]
    assert points[0].error == 100  # forecast 1000 - actual 900
    assert points[0].horizon_hours == 30
    assert points[1].forecast is None and points[1].error is None


def test_build_series_respects_window(index):
    actuals = [Actual(T0 - h(1), 1), Actual(T0, 2), Actual(T0 + h(1), 3)]
    points = analysis.build_series(actuals, index, lambda t: None, start=T0, end=T0 + h(1))
    assert [p.time for p in points] == [T0]


def test_compute_metrics():
    pts = [
        analysis.Point(T0, actual=100, forecast=110, publish_time=T0),  # +10
        analysis.Point(T0, actual=100, forecast=80, publish_time=T0),  # -20
        analysis.Point(T0, actual=100, forecast=None, publish_time=None),  # ignored
    ]
    m = analysis.compute_metrics(pts)
    assert m["count"] == 2
    assert m["mae"] == 15
    assert m["bias"] == -5
    assert m["rmse"] == pytest.approx((250) ** 0.5)
    assert m["nmae_pct"] == 15
    assert m["max_abs_error"] == 20


def test_compute_metrics_empty():
    assert analysis.compute_metrics([]) == {"count": 0}


def test_quantile_matches_linear_interpolation():
    assert analysis.quantile([0, 10], 0.5) == 5
    assert analysis.quantile([1, 2, 3, 4, 5], 0.9) == pytest.approx(4.6)


def test_error_histogram_bins():
    pts = [analysis.Point(T0, 0, e, T0) for e in (-600, -100, 100, 450)]
    hist = analysis.error_histogram(pts, bin_width=500)
    assert [(b["bin_start"], b["count"]) for b in hist] == [(-1000, 1), (-500, 1), (0, 2)]
