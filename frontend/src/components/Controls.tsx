import { useEffect, useState } from "react";
import type { Mode, Query } from "../types";

interface Props {
  query: Query;
  onChange: (q: Query) => void;
  minDate: string;
  maxDate: string;
  maxHorizon: number;
}

export function Controls({ query, onChange, minDate, maxDate, maxHorizon }: Props) {
  // The slider updates locally while dragging and commits on release to avoid a request per tick.
  const [horizon, setHorizon] = useState(query.horizon);
  useEffect(() => setHorizon(query.horizon), [query.horizon]);
  const commitHorizon = () => horizon !== query.horizon && onChange({ ...query, horizon });

  const setMode = (mode: Mode) => onChange({ ...query, mode });

  return (
    <div className="controls" role="group" aria-label="Analysis settings">
      <div className="control">
        <span className="control-label">Forecast used</span>
        <div className="segmented">
          <button aria-pressed={query.mode === "dayahead"} onClick={() => setMode("dayahead")}>
            Day-ahead decision
          </button>
          <button aria-pressed={query.mode === "horizon"} onClick={() => setMode("horizon")}>
            Fixed lead time
          </button>
        </div>
      </div>

      <div className={`control horizon ${query.mode === "dayahead" ? "disabled" : ""}`}>
        <label className="control-label" htmlFor="horizon">
          Lead time: <strong>{horizon}h</strong> before delivery
        </label>
        <input
          id="horizon"
          type="range"
          min={0}
          max={maxHorizon}
          step={1}
          value={horizon}
          disabled={query.mode === "dayahead"}
          onChange={(e) => setHorizon(Number(e.target.value))}
          onPointerUp={commitHorizon}
          onKeyUp={commitHorizon}
          onBlur={commitHorizon}
        />
      </div>

      <div className="control">
        <span className="control-label">Delivery dates (UTC)</span>
        <div className="dates">
          <input
            type="date"
            aria-label="From"
            min={minDate}
            max={query.endDate}
            value={query.startDate}
            onChange={(e) => e.target.value && onChange({ ...query, startDate: e.target.value })}
          />
          <span aria-hidden>→</span>
          <input
            type="date"
            aria-label="To"
            min={query.startDate}
            max={maxDate}
            value={query.endDate}
            onChange={(e) => e.target.value && onChange({ ...query, endDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
