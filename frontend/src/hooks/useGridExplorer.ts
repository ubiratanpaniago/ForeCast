import { useEffect, useState } from "react";
import {
  getGridCatalog,
  getContext,
  getGridCells,
  getCellDetail,
} from "../services/gridApi";
import type { GridDefinition, GridCells, CellDetail } from "../types/grid";
import type {
  IndicatorId,
  RegionsGeoJSON,
  LoadState,
} from "../types/geography";
export function useGridCatalog(retry: number) {
  const [catalog, setCatalog] = useState<GridDefinition[]>([]);
  const [context, setContext] = useState<RegionsGeoJSON | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<LoadState>("loading");
  useEffect(() => {
    const c = new AbortController();
    setStatus("loading");
    setError("");
    getContext(c.signal)
      .then((data) => {
        if (!c.signal.aborted) setContext(data);
      })
      .catch(() => {});
    getGridCatalog(c.signal)
      .then((data) => {
        if (!c.signal.aborted) {
          setCatalog(data);
          setStatus("ready");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setCatalog([]);
          setError(String(e.message));
          setStatus("error");
        }
      });
    return () => c.abort();
  }, [retry]);
  return { catalog, context, error, status };
}
export function useGridData(
  grid: GridDefinition | undefined,
  indicator: IndicatorId,
  start: number,
  end: number,
  selectedId: string | null,
  retry: number,
) {
  const [cells, setCells] = useState<GridCells | null>(null);
  const [detail, setDetail] = useState<CellDetail | null>(null);
  const [status, setStatus] = useState<LoadState>("ready");
  const [detailStatus, setDetailStatus] = useState<LoadState>("ready");
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setCells(null);
    setError("");
    if (!grid?.available) {
      setStatus("ready");
      return () => c.abort();
    }
    setStatus("loading");
    getGridCells(grid, indicator, { start, end }, c.signal)
      .then((data) => {
        if (!c.signal.aborted) {
          setCells(data);
          setStatus("ready");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(e.message);
          setStatus("error");
        }
      });
    return () => c.abort();
  }, [grid, indicator, start, end, retry]);
  useEffect(() => {
    const c = new AbortController();
    setDetail(null);
    setDetailError("");
    if (
      !grid?.available ||
      !selectedId ||
      !cells?.features.some((f) => f.properties.id === selectedId)
    ) {
      setDetailStatus("ready");
      return () => c.abort();
    }
    setDetailStatus("loading");
    getCellDetail(grid, selectedId, indicator, { start, end }, c.signal)
      .then((data) => {
        if (!c.signal.aborted) {
          setDetail(data);
          setDetailStatus("ready");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setDetailError(e.message);
          setDetailStatus("error");
        }
      });
    return () => c.abort();
  }, [grid, cells, selectedId, indicator, start, end, retry]);
  return { cells, detail, status, detailStatus, error, detailError };
}
