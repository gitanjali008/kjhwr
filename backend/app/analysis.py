"""Pure analysis functions: forecast selection, pairing and error metrics.

Nothing here performs I/O, which keeps the logic easy to unit test.

Conventions
-----------
* error = forecast - actual  (positive => forecast over-estimated wind,
  i.e. the buyer would have under-procured power).
* Forecast horizon = target start_time - forecast publish_time.
"""
from __future__ import annotations

import bisect
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable, Iterable, Optional

from .elexon import Actual, Forecast

Selector = Callable[[datetime], Optional[Forecast]]


class ForecastIndex:
    """Forecasts grouped by target time, sorted by publish time, for fast 'as-of' lookups."""

    def __init__(self, forecasts: Iterable[Forecast]):
        grouped: dict[datetime, list[Forecast]] = defaultdict(list)
        for f in forecasts:
            grouped[f.start_time].append(f)
        self._by_target = {t: sorted(fs, key=lambda f: f.publish_time) for t, fs in grouped.items()}
        self._publish_times = {t: [f.publish_time for f in fs] for t, fs in self._by_target.items()}

    def latest_as_of(self, target: datetime, as_of: datetime) -> Optional[Forecast]:
        """Most recent forecast for `target` published at or before `as_of`."""
        times = self._publish_times.get(target)
        if not times:
            return None
        i = bisect.bisect_right(times, as_of)
        return self._by_target[target][i - 1] if i else None

    def targets(self) -> list[datetime]:
        return sorted(self._by_target)


def fixed_horizon_selector(index: ForecastIndex, horizon_hours: float) -> Selector:
    """Latest forecast published at least `horizon_hours` before the target time."""
    delta = timedelta(hours=horizon_hours)
    return lambda target: index.latest_as_of(target, target - delta)


def day_ahead_selector(index: ForecastIndex, cutoff_hour_utc: int) -> Selector:
    """Latest forecast available at the day-ahead decision cutoff (cutoff hour on D-1)."""

    def select(target: datetime) -> Optional[Forecast]:
        day = target.replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff = day - timedelta(days=1) + timedelta(hours=cutoff_hour_utc)
        return index.latest_as_of(target, cutoff)

    return select


@dataclass(frozen=True)
class Point:
    time: datetime
    actual: Optional[float]
    forecast: Optional[float]
    publish_time: Optional[datetime]

    @property
    def horizon_hours(self) -> Optional[float]:
        if self.publish_time is None:
            return None
        return (self.time - self.publish_time).total_seconds() / 3600

    @property
    def error(self) -> Optional[float]:
        if self.actual is None or self.forecast is None:
            return None
        return self.forecast - self.actual


def build_series(
    actuals: list[Actual],
    index: ForecastIndex,
    select: Selector,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> list[Point]:
    """Merge half-hourly actuals with the selected (hourly) forecasts on a shared time axis."""
    actual_by_time = {a.start_time: a.generation for a in actuals}
    times = sorted(set(actual_by_time) | set(index.targets()))
    points = []
    for t in times:
        if (start and t < start) or (end and t >= end):
            continue
        f = select(t)
        points.append(
            Point(
                time=t,
                actual=actual_by_time.get(t),
                forecast=f.generation if f else None,
                publish_time=f.publish_time if f else None,
            )
        )
    return points


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def quantile(sorted_values: list[float], q: float) -> float:
    """Linear-interpolated quantile of an already sorted list (same as numpy's default)."""
    if not sorted_values:
        return math.nan
    pos = (len(sorted_values) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)


def compute_metrics(points: Iterable[Point]) -> dict:
    paired = [p for p in points if p.error is not None]
    n = len(paired)
    if n == 0:
        return {"count": 0}
    errors = [p.error for p in paired]
    abs_errors = sorted(abs(e) for e in errors)
    signed = sorted(errors)
    mean_actual = sum(p.actual for p in paired) / n
    mae = sum(abs_errors) / n
    return {
        "count": n,
        "mae": mae,
        "rmse": math.sqrt(sum(e * e for e in errors) / n),
        "bias": sum(errors) / n,
        "mean_actual": mean_actual,
        # MAE relative to mean actual generation; robust where hourly MAPE explodes at low wind.
        "nmae_pct": 100 * mae / mean_actual if mean_actual else None,
        "p50_abs_error": quantile(abs_errors, 0.50),
        "p90_abs_error": quantile(abs_errors, 0.90),
        "p95_abs_error": quantile(abs_errors, 0.95),
        "p99_abs_error": quantile(abs_errors, 0.99),
        "max_abs_error": abs_errors[-1],
        # Signed error band: actual wind fell within [forecast - p95, forecast - p05] 90% of the time.
        "p05_error": quantile(signed, 0.05),
        "p95_error": quantile(signed, 0.95),
    }


def metrics_by_horizon(actuals: list[Actual], index: ForecastIndex, horizons: Iterable[float]) -> list[dict]:
    rows = []
    for h in horizons:
        m = compute_metrics(build_series(actuals, index, fixed_horizon_selector(index, h)))
        rows.append({"horizon_hours": h, **m})
    return rows


def metrics_by_hour_of_day(points: list[Point]) -> list[dict]:
    buckets: dict[int, list[Point]] = defaultdict(list)
    for p in points:
        buckets[p.time.hour].append(p)
    return [{"hour": h, **compute_metrics(buckets[h])} for h in range(24)]


def error_histogram(points: list[Point], bin_width: float = 500) -> list[dict]:
    counts: dict[int, int] = defaultdict(int)
    for p in points:
        if p.error is not None:
            counts[math.floor(p.error / bin_width)] += 1
    return [
        {"bin_start": b * bin_width, "bin_end": (b + 1) * bin_width, "count": counts[b]}
        for b in range(min(counts), max(counts) + 1)
    ] if counts else []
