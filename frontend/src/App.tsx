import { useEffect, useState } from "react";
import { api } from "./api";
import { ErrorHistogram, HourOfDayChart } from "./components/BarCharts";
import { ChartCard, Legend } from "./components/ChartCard";
import { Controls } from "./components/Controls";
import { DataTable } from "./components/DataTable";
import { HorizonChart } from "./components/HorizonChart";
import { StatTiles } from "./components/StatTiles";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { formatMW } from "./format";
import { useTheme } from "./theme";
import type { Health, HorizonMetrics, MetricsResponse, Query, SeriesPoint } from "./types";

const MIN_DATE = "2026-01-01";
const MAX_DATE = "2026-02-01";
const MAX_HORIZON = 48;

const INITIAL_QUERY: Query = { mode: "dayahead", horizon: 24, startDate: MIN_DATE, endDate: MAX_DATE };

export default function App() {
  const { chart: theme, isDark, toggle: toggleTheme } = useTheme();
  const [query, setQuery] = useState<Query>(INITIAL_QUERY);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [horizons, setHorizons] = useState<HorizonMetrics[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => undefined);
    api.horizons().then(setHorizons).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.series(query), api.metrics(query)])
      .then(([s, m]) => {
        if (cancelled) return;
        setSeries(s);
        setMetrics(m);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const selectionLabel =
    query.mode === "dayahead"
      ? "the latest forecast available at 11:00 on the day before delivery (GB day-ahead auction)"
      : `the latest forecast published at least ${query.horizon}h before each delivery hour`;

  const m = metrics?.overall;
  const lineLegend = <Legend items={[{ label: "Actual", color: theme.actual }, { label: "Forecast", color: theme.forecast }]} />;

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">GB national wind · January 2026</p>
          <h1>Wind Forecast Insight</h1>
          <p className="lede">
            How much wind can you count on when you buy power day-ahead? Compare Elexon's wind forecasts with what
            was actually generated, and see how wrong they typically are.
          </p>
        </div>
        <div className="masthead-actions">
          {health && (
            <span className="badge" title={`${health.actuals} actuals, ${health.forecasts} forecasts`}>
              <span className="badge-dot" /> Data: {health.source === "elexon-live" ? "Elexon BMRS (live)" : "Elexon snapshot"}
            </span>
          )}
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <Controls query={query} onChange={setQuery} minDate={MIN_DATE} maxDate={MAX_DATE} maxHorizon={MAX_HORIZON} />

      {error && (
        <div className="alert" role="alert">
          Could not load data. {error}
        </div>
      )}

      <main className={loading ? "loading" : ""} aria-busy={loading}>
        {m && <StatTiles m={m} />}

        {m && m.count > 0 && m.bias != null && (
          <p className="insight">
            <strong>What this means for procurement:</strong> using {selectionLabel}, the forecast was on average{" "}
            <strong>{formatMW(Math.abs(m.bias))} {m.bias > 0 ? "too high" : "too low"}</strong>. In 90% of hours,
            actual wind landed between <strong>{formatMW(-(m.p95_error ?? 0), true)}</strong> and{" "}
            <strong>{formatMW(-(m.p05_error ?? 0), true)}</strong> of the forecast. Size the volume you buy for
            this band, not the raw forecast.
          </p>
        )}

        <ChartCard
          title="Actual vs. forecast wind generation"
          subtitle={`Forecast shown = ${selectionLabel}. Hover for details.`}
          legend={lineLegend}
          className="wide"
        >
          <TimeSeriesChart data={series} theme={theme} />
        </ChartCard>

        <div className="grid">
          <ChartCard
            title="Error grows with lead time"
            subtitle="Whole month. The vertical line marks your selected lead time."
            legend={
              <Legend
                items={[
                  { label: "Typical (MAE)", color: theme.actual },
                  { label: "90th percentile", color: theme.forecast },
                ]}
              />
            }
          >
            <HorizonChart data={horizons} selected={query.mode === "horizon" ? query.horizon : null} theme={theme} />
          </ChartCard>

          <ChartCard title="Error distribution" subtitle="Hours by forecast − actual. Right of zero = forecast too high.">
            {metrics && <ErrorHistogram data={metrics.histogram} theme={theme} />}
          </ChartCard>

          <ChartCard title="Error by time of day" subtitle="Typical error for each delivery hour.">
            {metrics && <HourOfDayChart data={metrics.by_hour_of_day} theme={theme} />}
          </ChartCard>

          <ChartCard title="About this analysis">
            <ul className="notes">
              <li>
                <strong>Actuals:</strong> Elexon FUELHH, fuel type WIND (half-hourly metered output).
              </li>
              <li>
                <strong>Forecasts:</strong> Elexon WINDFOR (hourly, re-published several times a day, up to ~2 days
                ahead). Compared on the hour.
              </li>
              <li>
                <strong>Error</strong> = forecast − actual. Positive means less wind than forecast, so more power
                had to be bought.
              </li>
              <li>
                A persistent positive bias is consistent with wind farms being curtailed for grid constraints. Metered
                output falls below what the weather allowed.
              </li>
            </ul>
          </ChartCard>
        </div>

        <DataTable data={series} />
      </main>

      <footer className="footer">Source: Elexon BMRS Insights API. Times in UTC (equal to UK time in January).</footer>
    </div>
  );
}
