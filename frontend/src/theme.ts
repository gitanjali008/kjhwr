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

type Choice = "light" | "dark" | null; // null = follow the OS setting

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readChoice(): Choice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/** Light/dark theme: the toggle's saved choice wins, otherwise the OS setting. */
export function useTheme() {
  const [choice, setChoice] = useState<Choice>(readChoice);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice) root.dataset.theme = choice;
    else delete root.dataset.theme;
  }, [choice]);

  const isDark = choice ? choice === "dark" : systemDark;

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    setChoice(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (e.g. private mode): the choice lasts for this visit only.
    }
  };

  return { chart: isDark ? dark : light, isDark, toggle };
}

export const axisProps = (t: ChartTheme) => ({
  stroke: t.axis,
  tick: { fill: t.muted, fontSize: 12 },
  tickLine: false,
});
