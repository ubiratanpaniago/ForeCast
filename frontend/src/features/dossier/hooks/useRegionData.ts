import { useEffect, useMemo, useState } from "react";
import { fetchSnapshot } from "../services/api";
import type { CellReading, Snapshot, YearSummary } from "../types/climate";

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: Snapshot };

export function useSnapshot(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: "loading" });
    fetchSnapshot(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ status: "ready", data });
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted)
          setState({
            status: "error",
            error:
              e instanceof TypeError
                ? "Não foi possível conectar à API. Verifique se o backend está em execução."
                : e.message,
          });
      });
    return () => ctrl.abort();
  }, [attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

const nearest = (arr: number[], x: number) => {
  let best = 0;
  for (let i = 1; i < arr.length; i++)
    if (Math.abs(arr[i] - x) < Math.abs(arr[best] - x)) best = i;
  return best;
};

/** Máscara de terra reamostrada para a grade dos totais anuais. */
export function useGridLand(data: Snapshot): boolean[] {
  return useMemo(() => {
    const { grid, landMask } = data;
    const out: boolean[] = [];
    for (const lat of grid.lat) {
      const row = landMask.rows[nearest(landMask.lat, lat)];
      for (const lon of grid.lon)
        out.push(row[nearest(landMask.lon, lon)] === "1");
    }
    return out;
  }, [data]);
}

export function anomalyPct(total: number, clim: number) {
  return clim > 0 ? ((total - clim) / clim) * 100 : 0;
}

export function readCell(
  data: Snapshot,
  land: boolean[],
  year: number,
  i: number,
  j: number,
): CellReading {
  const idx = i * data.grid.lon.length + j;
  const total = data.annual.byYear[year][idx];
  const climatology = data.annual.climatology[idx];
  return {
    lat: data.grid.lat[i],
    lon: data.grid.lon[j],
    total,
    climatology,
    anomalyPct: anomalyPct(total, climatology),
    land: land[idx],
  };
}

export function useYearSummary(data: Snapshot, year: number): YearSummary {
  return useMemo(() => {
    const { regional, regionalClimatology } = data.annual;
    const total = regional[year];
    const rankDry = data.years.filter((y) => regional[y] < total).length + 1;
    const months = data.monthly.precipitation.filter((p) =>
      p.t.startsWith(`${year}-`),
    );
    const byValue = [...months].sort((a, b) => a.v - b.v);
    const soil = data.monthly.soilMoisture.filter((p) =>
      p.t.startsWith(`${year}-`),
    );
    return {
      year,
      total,
      anomalyPct: anomalyPct(total, regionalClimatology),
      rankDry,
      driestMonth: byValue[0],
      wettestMonth: byValue[byValue.length - 1],
      soilMean: soil.length
        ? soil.reduce((s, p) => s + p.v, 0) / soil.length
        : null,
      soilMonths: soil.length,
    };
  }, [data, year]);
}
