import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGW, formatMW } from "../format";
import { axisProps, type ChartTheme } from "../theme";
import type { HistogramBin, HourMetrics } from "../types";
import { TooltipBox } from "./ChartCard";

const barShape = { radius: [4, 4, 0, 0] as [number, number, number, number] };

/** Distribution of forecast - actual errors. Single series, so one colour throughout. */
export function ErrorHistogram({ data, theme }: { data: HistogramBin[]; theme: ChartTheme }) {
  const rows = data.map((b) => ({ ...b, mid: (b.bin_start + b.bin_end) / 2 }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 16, left: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="mid"
          type="number"
          domain={["dataMin - 250", "dataMax + 250"]}
          tickFormatter={formatGW}
          label={{ value: "Error: forecast − actual", position: "insideBottom", offset: -8, fill: theme.muted, fontSize: 12 }}
          {...axisProps(theme)}
        />
        <YAxis width={40} axisLine={false} allowDecimals={false} {...axisProps(theme)} />
        <ReferenceLine x={0} stroke={theme.muted} />
        <Tooltip
          cursor={{ fill: theme.grid, opacity: 0.5 }}
          content={({ active, payload }) => {
            const b = active && (payload?.[0]?.payload as HistogramBin | undefined);
            if (!b) return null;
            return (
              <TooltipBox
                title={`${formatMW(b.bin_start, true)} to ${formatMW(b.bin_end, true)}`}
                rows={[{ label: "Hours", value: String(b.count), color: theme.actual }]}
              />
            );
          }}
        />
        <Bar dataKey="count" fill={theme.actual} {...barShape} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Mean absolute error by hour of day (UTC = UK time in January). */
export function HourOfDayChart({ data, theme }: { data: HourMetrics[]; theme: ChartTheme }) {
  const rows = data.filter((d) => d.count > 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 16, left: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="hour"
          tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
          interval={2}
          label={{ value: "Hour of day (UK time)", position: "insideBottom", offset: -8, fill: theme.muted, fontSize: 12 }}
          {...axisProps(theme)}
        />
        <YAxis tickFormatter={formatGW} width={52} axisLine={false} {...axisProps(theme)} />
        <Tooltip
          cursor={{ fill: theme.grid, opacity: 0.5 }}
          content={({ active, payload }) => {
            const h = active && (payload?.[0]?.payload as HourMetrics | undefined);
            if (!h) return null;
            return (
              <TooltipBox
                title={`${String(h.hour).padStart(2, "0")}:00 – ${String(h.hour).padStart(2, "0")}:59`}
                rows={[
                  { label: "Typical error (MAE)", value: formatMW(h.mae), color: theme.actual },
                  { label: "Bias", value: formatMW(h.bias, true) },
                  { label: "Hours compared", value: String(h.count) },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="mae" fill={theme.actual} {...barShape} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
