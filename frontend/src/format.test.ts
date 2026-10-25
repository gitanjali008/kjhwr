import { describe, expect, it } from "vitest";
import { toParams } from "./api";
import { addDays, formatGW, formatMW, formatPct } from "./format";

describe("format", () => {
  it("formats MW with thousands separators and signs", () => {
    expect(formatMW(1234.6)).toBe("1,235 MW");
    expect(formatMW(-50)).toBe("−50 MW");
    expect(formatMW(50, true)).toBe("+50 MW");
    expect(formatMW(null)).toBe("–");
  });

  it("formats GW axis ticks with at most one decimal", () => {
    expect(formatGW(2500)).toBe("2.5 GW");
    expect(formatGW(3000)).toBe("3 GW");
    expect(formatGW(-1000)).toBe("−1 GW");
  });

  it("formats percentages", () => {
    expect(formatPct(17.56)).toBe("17.6%");
    expect(formatPct(null)).toBe("–");
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("toParams", () => {
  it("turns an inclusive date range into an exclusive UTC window", () => {
    expect(toParams({ mode: "horizon", horizon: 24, startDate: "2026-01-05", endDate: "2026-01-05" })).toEqual({
      mode: "horizon",
      horizon: 24,
      start: "2026-01-05T00:00:00Z",
      end: "2026-01-06T00:00:00Z",
    });
  });
});
