import type { Health, HorizonMetrics, MetricsResponse, Query, SeriesPoint } from "./types";
import { addDays } from "./format";

// Empty base => same-origin "/api" (Vite proxy in dev, nginx/Vercel rewrite in prod).
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${API_BASE}${path}${qs.size ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function toParams(q: Query) {
  return {
    mode: q.mode,
    horizon: q.horizon,
    start: `${q.startDate}T00:00:00Z`,
    end: `${addDays(q.endDate, 1)}T00:00:00Z`, // backend end is exclusive
  };
}

export const api = {
  health: () => get<Health>("/api/health"),
  series: (q: Query) => get<SeriesPoint[]>("/api/series", toParams(q)),
  metrics: (q: Query) => get<MetricsResponse>("/api/metrics", toParams(q)),
  horizons: () => get<HorizonMetrics[]>("/api/metrics/horizons"),
};
