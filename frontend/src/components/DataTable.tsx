import { formatDateTime, formatMW } from "../format";
import type { SeriesPoint } from "../types";

/** Accessible table view of the paired data, plus CSV export for the trading team. */
export function DataTable({ data }: { data: SeriesPoint[] }) {
  const paired = data.filter((p) => p.forecast != null);

  const downloadCsv = () => {
    const header = "time_utc,actual_mw,forecast_mw,error_mw,forecast_published_utc,lead_time_h";
    const lines = paired.map((p) =>
      [p.time, p.actual ?? "", p.forecast ?? "", p.error ?? "", p.publish_time ?? "", p.horizon_hours ?? ""].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wind_forecast_vs_actual.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <details className="card table-card">
      <summary>
        <span>Data table ({paired.length} hours)</span>
        <button
          className="link-button"
          onClick={(e) => {
            e.preventDefault();
            downloadCsv();
          }}
        >
          Download CSV
        </button>
      </summary>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Delivery hour (UTC)</th>
              <th>Actual</th>
              <th>Forecast</th>
              <th>Error</th>
              <th>Forecast published</th>
            </tr>
          </thead>
          <tbody>
            {paired.map((p) => (
              <tr key={p.time}>
                <td>{formatDateTime(p.time)}</td>
                <td>{formatMW(p.actual)}</td>
                <td>{formatMW(p.forecast)}</td>
                <td>{formatMW(p.error, true)}</td>
                <td>
                  {p.publish_time && formatDateTime(p.publish_time)} ({p.horizon_hours}h)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
