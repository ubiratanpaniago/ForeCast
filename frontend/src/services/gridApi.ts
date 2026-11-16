import type { GridDefinition, GridCells, CellDetail } from "../types/grid";
import { studyBounds } from "../types/grid";
import type { IndicatorId, Period, RegionsGeoJSON } from "../types/geography";
import { parseTrendResult } from "./trendContract";
import { apiFetch } from "./apiFetch";
import { indicators } from "../components/Map/MapLayers";
export const gridApiMode = import.meta.env.VITE_GRID_MODE !== "local";
const base = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");
export async function gridRequest(
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await apiFetch(url, { signal, timeoutMs: 15000 });
  if (!response.ok)
    throw new Error(
      `Dados indisponíveis (HTTP ${response.status}). Nenhuma grade sintética foi usada.`,
    );
  return response.json();
}
export async function getGridCatalog(
  signal: AbortSignal,
): Promise<GridDefinition[]> {
  const data = (await gridRequest(
    gridApiMode ? `${base}/api/grids` : "/data/grids/catalog.json",
    signal,
  )) as { grids: GridDefinition[] };
  if (
    !Array.isArray(data?.grids) ||
    data.grids.some(
      (g) =>
        !g ||
        typeof g.id !== "string" ||
        !g.id ||
        typeof g.name !== "string" ||
        typeof g.productId !== "string" ||
        typeof g.version !== "string" ||
        typeof g.revision !== "string" ||
        ![0.1, 0.25].includes(g.resolutionDegrees) ||
        g.crs !== "EPSG:4326" ||
        typeof g.available !== "boolean" ||
        !Array.isArray(g.indicators) ||
        !g.indicators.length ||
        g.indicators.some((i) => !(i in indicators)) ||
        !Number.isInteger(g.period?.start) ||
        !Number.isInteger(g.period?.end) ||
        g.period.start > g.period.end,
    ) ||
    new Set(data.grids.map((g) => g.id)).size !== data.grids.length
  )
    throw new Error("Catálogo de grades incompatível com o contrato.");
  return data.grids;
}
export async function getContext(signal: AbortSignal): Promise<RegionsGeoJSON> {
  return (await gridRequest(
    "/data/south-regions.geojson",
    signal,
  )) as RegionsGeoJSON;
}
function samePeriod(a: Period, b: Period) {
  return a?.start === b.start && a?.end === b.end;
}
function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
export function parseGridCells(
  input: unknown,
  grid: GridDefinition,
  indicator: IndicatorId,
  period: Period,
): GridCells {
  const data = input as GridCells;
  if (
    !data ||
    data.type !== "FeatureCollection" ||
    data.gridId !== grid.id ||
    data.revision !== grid.revision ||
    data.indicator !== indicator ||
    !samePeriod(data.period, period) ||
    !Array.isArray(data.features) ||
    data.features.length > 20000 ||
    typeof data.truncated !== "boolean"
  )
    throw new Error(
      "Grade incompatível com produto, revisão ou período solicitado.",
    );
  if (data.truncated)
    throw new Error(
      "A grade retornou um recorte incompleto. O backend deve servir o recorte completo ou implementar tiles.",
    );
  const ids = new Set<string>();
  for (const feature of data.features) {
    const p = feature?.properties;
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      p.gridId !== grid.id ||
      !Number.isInteger(p.row) ||
      !Number.isInteger(p.column) ||
      p.row < 0 ||
      p.column < 0 ||
      !Array.isArray(p.bounds) ||
      p.bounds.length !== 4 ||
      !p.bounds.every(finite) ||
      !Array.isArray(p.center) ||
      p.center.length !== 2 ||
      !p.center.every(finite) ||
      !(
        p.fractionInside === null ||
        (finite(p.fractionInside) &&
          p.fractionInside > 0 &&
          p.fractionInside <= 1)
      )
    )
      throw new Error("Célula inválida ou ID duplicado.");
    ids.add(p.id);
    if (p.annualValue !== undefined &&
      (data.year !== period.end || !(p.annualValue === null || (finite(p.annualValue) && p.annualValue >= 0))))
      throw new Error("Valor anual inválido ou de outro ano.");
    const [w, s, e, n] = p.bounds;
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    if (
      !near(e - w, grid.resolutionDegrees) ||
      !near(n - s, grid.resolutionDegrees) ||
      !near(p.center[0], (w + e) / 2) ||
      !near(p.center[1], (s + n) / 2) ||
      w < -180 ||
      e > 180 ||
      s < -90 ||
      n > 90 ||
      e <= studyBounds[0] ||
      w >= studyBounds[2] ||
      n <= studyBounds[1] ||
      s >= studyBounds[3]
    )
      throw new Error(
        "Célula fora do recorte ou da resolução nativa declarada.",
      );
    const ring = feature.geometry?.coordinates?.[0];
    if (
      feature.geometry?.type !== "Polygon" ||
      feature.geometry.coordinates.length !== 1 ||
      ring?.length !== 5 ||
      ring.some(
        (c) => !Array.isArray(c) || c.length !== 2 || !c.every(finite),
      ) ||
      !near(ring[0][0], ring[4][0]) ||
      !near(ring[0][1], ring[4][1])
    )
      throw new Error("Geometria de célula inválida.");
    const corners = [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
    ];
    if (
      corners.some(
        (c) =>
          !ring.slice(0, 4).some((r) => near(c[0], r[0]) && near(c[1], r[1])),
      ) ||
      ring.slice(0, 4).some((r, i) => {
        const next = ring[(i + 1) % 4];
        return !near(r[0], next[0]) && !near(r[1], next[1]);
      })
    )
      throw new Error(
        "Polígono não corresponde aos limites nativos da célula.",
      );
    if (p.summary !== null) {
      const summary = p.summary;
      if (!summary || summary.metadata?.demonstrative !== false)
        throw new Error(
          "Resumo de célula deve conter dados reais identificados.",
        );
      // Reutiliza as regras estatísticas sem baixar séries para todas as células.
      parseTrendResult(
        {
          ...summary,
          regionId: p.id,
          series: Array.from(
            { length: period.end - period.start + 1 },
            (_, i) => ({ year: period.start + i, value: null }),
          ),
        },
        p.id,
        { layer: "trend", indicator, ...period },
      );
    }
  }
  return data;
}
export async function getGridCells(
  grid: GridDefinition,
  indicator: IndicatorId,
  period: Period,
  signal: AbortSignal,
): Promise<GridCells> {
  const params = new URLSearchParams({
    indicator,
    start: String(period.start),
    end: String(period.end),
    bbox: studyBounds.join(","),
    limit: "20000",
  });
  const url = gridApiMode
    ? `${base}/api/grids/${encodeURIComponent(grid.id)}/cells?${params}`
    : `/data/grids/${encodeURIComponent(grid.id)}/cells/${indicator}/${period.start}-${period.end}.geojson`;
  return parseGridCells(
    await gridRequest(url, signal),
    grid,
    indicator,
    period,
  );
}
export function parseCellDetail(
  input: unknown,
  grid: GridDefinition,
  id: string,
  indicator: IndicatorId,
  period: Period,
): CellDetail {
  const data = input as CellDetail;
  if (
    !data ||
    data.gridId !== grid.id ||
    data.revision !== grid.revision ||
    data.cellId !== id ||
    data.indicator !== indicator ||
    !samePeriod(data.period, period) ||
    data.metadata?.demonstrative !== false
  )
    throw new Error("Resposta da célula não corresponde à seleção.");
  const checked = {
    ...data,
    regionId: id,
    statistics: data.statistics ?? {
      slopePerDecade: null,
      pValue: null,
      tau: null,
      confidenceInterval95: null,
      direction: "inconclusive",
      status: "insufficient",
      method: "Análise estatística ainda não produzida",
    },
  };
  parseTrendResult(checked, id, { layer: "trend", indicator, ...period });
  return data;
}
export async function getCellDetail(
  grid: GridDefinition,
  id: string,
  indicator: IndicatorId,
  period: Period,
  signal: AbortSignal,
): Promise<CellDetail> {
  const params = new URLSearchParams({
    indicator,
    start: String(period.start),
    end: String(period.end),
  });
  const url = gridApiMode
    ? `${base}/api/grids/${encodeURIComponent(grid.id)}/cells/${encodeURIComponent(id)}/timeseries?${params}`
    : `/data/grids/${encodeURIComponent(grid.id)}/series/${encodeURIComponent(id)}/${indicator}/${period.start}-${period.end}.json`;
  return parseCellDetail(
    await gridRequest(url, signal),
    grid,
    id,
    indicator,
    period,
  );
}
