import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime, formatDay, formatGW, formatMW } from "../format";
import { axisProps, type ChartTheme } from "../theme";
import type { SeriesPoint } from "../types";
import { TooltipBox } from "./ChartCard";

interface Row extends SeriesPoint {
  t: number;
}

export function TimeSeriesChart({ data, theme }: { data: SeriesPoint[]; theme: ChartTheme }) {
  const rows: Row[] = useMemo(() => data.map((p) => ({ ...p, t: Date.parse(p.time) })), [data]);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={formatDay}
          minTickGap={40}
          {...axisProps(theme)}
        />
        <YAxis tickFormatter={formatGW} width={52} axisLine={false} {...axisProps(theme)} />
        <Tooltip
          cursor={{ stroke: theme.muted, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const p = active && (payload?.[0]?.payload as Row | undefined);
            if (!p) return null;
            return (
              <TooltipBox
                title={formatDateTime(p.t)}
                rows={[
                  { label: "Actual", value: formatMW(p.actual), color: theme.actual },
                  { label: "Forecast", value: formatMW(p.forecast), color: theme.forecast },
                  { label: "Error", value: formatMW(p.error, true) },
                  ...(p.publish_time
                    ? [{ label: "Published", value: `${formatDateTime(p.publish_time)} (${p.horizon_hours}h ahead)` }]
                    : []),
                ]}
              />
            );
          }}
        />
        <Line dataKey="actual" stroke={theme.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
        {/* Forecasts are hourly while actuals are half-hourly, so bridge the gaps. */}
        <Line
          dataKey="forecast"
          stroke={theme.forecast}
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
