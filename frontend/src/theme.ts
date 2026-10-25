import { useEffect, useState } from "react";

// SVG presentation attributes can't reliably read CSS variables, so chart colours
// are resolved in JS. Values mirror the tokens in styles.css (validated palette).
const light = {
  actual: "#2a78d6",
  forecast: "#eb6834",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  text: "#0b0b0b",
  surface: "#fcfcfb",
};

const dark: typeof light = {
  actual: "#3987e5",
  forecast: "#d95926",
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  text: "#f0efec",
  surface: "#1a1a19",
};

export type ChartTheme = typeof light;

export function useChartTheme(): ChartTheme {
  const query = "(prefers-color-scheme: dark)";
  const [isDark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDark ? dark : light;
}

export const axisProps = (t: ChartTheme) => ({
  stroke: t.axis,
  tick: { fill: t.muted, fontSize: 12 },
  tickLine: false,
});
