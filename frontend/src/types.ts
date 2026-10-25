export type Mode = "dayahead" | "horizon";

export interface SeriesPoint {
  time: string;
  actual: number | null;
  forecast: number | null;
  publish_time: string | null;
  horizon_hours: number | null;
  error: number | null;
}

export interface Metrics {
  count: number;
  mae?: number;
  rmse?: number;
  bias?: number;
  mean_actual?: number;
  nmae_pct?: number | null;
  p50_abs_error?: number;
  p90_abs_error?: number;
  p95_abs_error?: number;
  p99_abs_error?: number;
  max_abs_error?: number;
  p05_error?: number;
  p95_error?: number;
}

export interface HourMetrics extends Metrics {
  hour: number;
}

export interface HorizonMetrics extends Metrics {
  horizon_hours: number;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface MetricsResponse {
  overall: Metrics;
  by_hour_of_day: HourMetrics[];
  histogram: HistogramBin[];
}

export interface Health {
  status: string;
  source: string;
  actuals: number;
  forecasts: number;
}

export interface Query {
  mode: Mode;
  horizon: number;
  startDate: string; // YYYY-MM-DD, inclusive
  endDate: string; // YYYY-MM-DD, inclusive
}
