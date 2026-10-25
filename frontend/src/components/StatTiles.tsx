import { formatGW, formatMW, formatPct } from "../format";
import type { Metrics } from "../types";

const signedGW = (mw: number) => `${mw > 0 ? "+" : ""}${formatGW(mw)}`;

export function StatTiles({ m }: { m: Metrics }) {
  if (!m.count) return <p className="empty">No forecasts available for this selection.</p>;

  const tiles = [
    {
      label: "Typical error (MAE)",
      value: formatMW(m.mae),
      note: `${formatPct(m.nmae_pct)} of average wind output`,
    },
    {
      label: "Systematic bias",
      value: formatMW(m.bias, true),
      note: (m.bias ?? 0) > 0 ? "Forecast over-estimates wind" : "Forecast under-estimates wind",
    },
    {
      label: "90% of hours, error within",
      value: `±${formatMW(m.p90_abs_error)}`,
      note: `Worst hour: ${formatMW(m.max_abs_error)}`,
    },
    {
      label: "90% planning band",
      value: `${signedGW(-(m.p95_error ?? 0))} to ${signedGW(-(m.p05_error ?? 0))}`,
      note: "Actual wind relative to forecast (5th–95th pct.)",
    },
  ];

  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-value">{t.value}</div>
          <div className="tile-note">{t.note}</div>
        </div>
      ))}
    </div>
  );
}
