const mwFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function formatMW(value: number | null | undefined, signed = false): string {
  if (value == null || Number.isNaN(value)) return "–";
  const s = mwFormatter.format(Math.abs(value));
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  return `${sign}${s} MW`;
}

/** Axis label in GW: "2.5 GW", "−1 GW" (one decimal at most, so ticks never collide). */
export function formatGW(value: number): string {
  const gw = Number((value / 1000).toFixed(1));
  return `${gw < 0 ? "−" : ""}${Math.abs(gw)} GW`;
}

export function formatPct(value: number | null | undefined): string {
  return value == null ? "–" : `${value.toFixed(1)}%`;
}

/** "Mon 05 Jan, 14:00" in UTC (UK local time equals UTC in January). */
export function formatDateTime(iso: string | number): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

/** Add days to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
