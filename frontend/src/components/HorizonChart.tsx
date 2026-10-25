import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGW, formatMW } from "../format";
import { axisProps, type ChartTheme } from "../theme";
import type { HorizonMetrics } from "../types";
import { TooltipBox } from "./ChartCard";

interface Props {
  data: HorizonMetrics[];
  selected: number | null;
  theme: ChartTheme;
}

/** How forecast error grows with lead time - the core trade-off for when to commit. */
export function HorizonChart({ data, selected, theme }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="horizon_hours"
          type="number"
          domain={[0, 48]}
          ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
          tickFormatter={(h) => `${h}h`}
          label={{ value: "Lead time (hours before delivery)", position: "insideBottom", offset: -8, fill: theme.muted, fontSize: 12 }}
          {...axisProps(theme)}
        />
        <YAxis tickFormatter={formatGW} width={52} axisLine={false} domain={[0, "auto"]} {...axisProps(theme)} />
        {selected != null && <ReferenceLine x={selected} stroke={theme.muted} strokeWidth={1} />}
        <Tooltip
          cursor={{ stroke: theme.muted, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const p = active && (payload?.[0]?.payload as HorizonMetrics | undefined);
            if (!p) return null;
            return (
              <TooltipBox
                title={`${p.horizon_hours}h lead time`}
                rows={[
                  { label: "Typical error (MAE)", value: formatMW(p.mae), color: theme.actual },
                  { label: "90th pct. error", value: formatMW(p.p90_abs_error), color: theme.forecast },
                  { label: "Hours compared", value: String(p.count) },
                ]}
              />
            );
          }}
        />
        <Line dataKey="mae" stroke={theme.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="p90_abs_error" stroke={theme.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
