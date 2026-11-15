import { useEffect, useState } from "react";
import type { IndicatorId, TrendResult } from "../types/geography";
import {
  getCellFdr,
  getCrossings,
  getInfrastructureCatalog,
  getRegionCatalog,
  getRegionGeometry,
  getRegionSummary,
  getRegionTrend,
  getRoads,
  getTerrain,
  type CellFdr,
  type InfrastructureCatalog,
  type RegionCatalog,
  type RegionSummary,
} from "../services/regionApi";
import type { RegionsGeoJSON } from "../types/geography";

export type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "ready"; data: T };

export function useLoad<T>(load: (() => Promise<T>) | null, key: string): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: load ? "loading" : "idle" });
  useEffect(() => {
    if (!load) {
      setState({ status: "idle" });
      return;
    }
    let stale = false;
    setState({ status: "loading" });
    load()
      .then((data) => !stale && setState({ status: "ready", data }))
      .catch((e: { code?: string; message?: string }) => {
        if (!stale) setState({ status: "error", code: e.code ?? "ERROR", message: e.message ?? String(e) });
      });
    return () => {
      stale = true;
    };
    // `key` resume as dependências de `load`
  }, [key]);
  return state;
}

/** Catálogo (regiões, indicadores, período, revisão). */
export const useRegionCatalog = () => useLoad<RegionCatalog>(getRegionCatalog, "catalog");

/** Estatística das 24 regiões para um indicador, em uma requisição. */
export const useRegionSummary = (indicator: IndicatorId) =>
  useLoad<RegionSummary>(() => getRegionSummary(indicator), `summary:${indicator}`);

/** Série completa de uma região; nada é pedido enquanto `regionId` for null. */
export const useRegionTrend = (regionId: string | null, indicator: IndicatorId) =>
  useLoad<TrendResult>(regionId ? () => getRegionTrend(regionId, indicator) : null, `trend:${regionId}:${indicator}`);

export const useRegionGeometry = () => useLoad<RegionsGeoJSON>(getRegionGeometry, "geometry");

/** Contagem das células após FDR, por região, para um indicador. */
export const useCellFdr = (indicator: IndicatorId) =>
  useLoad<CellFdr>(() => getCellFdr(indicator), `cell-fdr:${indicator}`);

/** Camadas de infraestrutura: cada uma só é baixada quando ligada pela primeira vez. */
export function useInfrastructure(want: { roads: boolean; crossings: boolean; terrain: boolean }) {
  const any = want.roads || want.crossings || want.terrain;
  const [on, setOn] = useState(want);
  useEffect(() => {
    setOn((o) => ({ roads: o.roads || want.roads, crossings: o.crossings || want.crossings, terrain: o.terrain || want.terrain }));
  }, [want.roads, want.crossings, want.terrain]);
  const [catalogOn, setCatalogOn] = useState(any);
  useEffect(() => {
    if (any) setCatalogOn(true);
  }, [any]);
  return {
    catalog: useLoad<InfrastructureCatalog>(catalogOn ? getInfrastructureCatalog : null, `infra:${catalogOn}`),
    roads: useLoad(on.roads ? getRoads : null, `roads:${on.roads}`),
    crossings: useLoad(on.crossings ? getCrossings : null, `crossings:${on.crossings}`),
    terrain: useLoad(on.terrain ? getTerrain : null, `terrain:${on.terrain}`),
  };
}
