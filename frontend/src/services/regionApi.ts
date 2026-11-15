// Camada de acesso aos resultados regionais (21 regiões intermediárias + PR/SC/RS).
// Contrato: docs/api-contract.md › Regiões. Nada é calculado aqui; tudo vem da API.
//
// Carregamento sob demanda: catálogo e geometria uma vez; um resumo por indicador
// (estatística de todas as regiões, sem séries); a série completa só da região pedida.
import type { IndicatorId, Period, RegionsGeoJSON, TrendResult } from "../types/geography";
import { parseTrendResult } from "./trendContract";

export interface RegionInfo {
  id: string;
  name: string;
  abbreviation: string;
  level: "regiao_intermediaria" | "estado";
}

export interface RegionCatalog {
  revision: string;
  period: Period;
  indicators: Array<{ id: IndicatorId; name: string; unit: string; productId: string }>;
  regions: RegionInfo[];
}

export interface RegionSummary {
  revision: string;
  indicator: IndicatorId;
  period: Period;
  metadata: TrendResult["metadata"];
  /** region_id -> estatística (sem série) */
  regions: Record<string, TrendResult["statistics"]>;
}

/** Erro com o código do envelope da API (`{ error: { code, message } }`). */
export class RegionApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const base = () => (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// Uma requisição por URL; pedidos simultâneos compartilham a mesma promessa. Falhas não ficam em cache.
const cache = new Map<string, Promise<unknown>>();
export const clearRegionCache = () => cache.clear();

function get(path: string): Promise<unknown> {
  const url = `${base()}${path}`;
  let hit = cache.get(url);
  if (!hit) {
    hit = fetch(url, { signal: AbortSignal.timeout(15000) })
      .catch(() => {
        throw new RegionApiError(0, "NETWORK", "API indisponível. Verifique se o backend está rodando.");
      })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
          throw new RegionApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `HTTP ${res.status}`);
        }
        return body;
      });
    cache.set(url, hit);
    hit.catch(() => cache.delete(url));
  }
  return hit;
}

export async function getRegionCatalog(): Promise<RegionCatalog> {
  const data = (await get("/api/regions/catalog")) as RegionCatalog;
  const ids = data?.regions?.map((r) => r.id);
  if (
    typeof data?.revision !== "string" ||
    !Array.isArray(data.indicators) ||
    !data.indicators.length ||
    !ids?.length ||
    new Set(ids).size !== ids.length
  )
    throw new RegionApiError(200, "INVALID_CONTRACT", "Catálogo de regiões incompatível com o contrato.");
  return data;
}

export async function getRegionGeometry(): Promise<RegionsGeoJSON> {
  const data = (await get("/api/regions")) as RegionsGeoJSON;
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features) || !data.features.length)
    throw new RegionApiError(200, "INVALID_CONTRACT", "GeoJSON de regiões inválido.");
  return data;
}

/** Estatística de todas as regiões para um indicador, em uma única requisição. */
export async function getRegionSummary(indicator: IndicatorId): Promise<RegionSummary> {
  const [catalog, data] = await Promise.all([
    getRegionCatalog(),
    get(`/api/regions/summary?indicator=${encodeURIComponent(indicator)}`) as Promise<RegionSummary>,
  ]);
  if (data?.indicator !== indicator || data.revision !== catalog.revision || typeof data.regions !== "object")
    throw new RegionApiError(200, "INVALID_CONTRACT", "Resumo regional incompatível com o catálogo.");
  return data;
}

/** Série e estatística completas de uma região; validada por trendContract. */
export async function getRegionTrend(regionId: string, indicator: IndicatorId): Promise<TrendResult> {
  const { period } = await getRegionCatalog();
  const params = new URLSearchParams({ indicator, start: String(period.start), end: String(period.end) });
  const data = await get(`/api/regions/${encodeURIComponent(regionId)}/trends?${params}`);
  return parseTrendResult(data, regionId, { layer: "trend", indicator, ...period });
}

export interface CellFdrCounts {
  cells: number;
  increasing: number;
  decreasing: number;
  inconclusive: number;
  raw_p_below_005: number;
  no_data: number;
}

export interface CellFdr {
  revision: string;
  indicator: IndicatorId;
  gridId: string;
  resolutionDegrees: number;
  cellsTested: number;
  method: string;
  qualityNotes: string[];
  regions: Record<string, CellFdrCounts>;
}

/** Contagem, por região, das células com tendência após FDR (do pipeline; nada é recalculado). */
export async function getCellFdr(indicator: IndicatorId): Promise<CellFdr> {
  const [catalog, data] = await Promise.all([
    getRegionCatalog(),
    get(`/api/regions/cell-fdr?indicator=${encodeURIComponent(indicator)}`) as Promise<CellFdr>,
  ]);
  if (data?.indicator !== indicator || data.revision !== catalog.revision || typeof data.regions !== "object")
    throw new RegionApiError(200, "INVALID_CONTRACT", "Resumo de células incompatível com o catálogo.");
  return data;
}

// ---------- infraestrutura (rodovias × relevo) ----------

export type TerrainClass = "alta" | "media" | "baixa" | "sem_dado";

export interface RoadSegment {
  id: string;
  ref: string;
  refs: string[];
  jurisdiction: "federal" | "estadual";
  highway: string[];
  uf: "PR" | "SC" | "RS";
  regionId: string;
  regionName: string;
  lengthKm: number;
  lengthByClassKm: Record<TerrainClass, number>;
  shareHigh: number | null;
  crossingCount: number;
}

export interface Crossing {
  id: string;
  segmentId: string;
  ref: string;
  regionId: string;
  regionName: string;
  row: number;
  column: number;
  lengthKm: number;
  susceptibleFraction: number | null;
  elevationMeanM: number | null;
  slopeMeanDeg: number | null;
}

export interface InfrastructureCatalog {
  revision: string;
  sources: {
    roads: { name: string; license: string; attribution: string; query: string; osmBase: Record<string, string> };
    terrain: { name: string; method: string; resolutionDegrees: number };
  };
  parameters: { stepKm: number; minCrossingKm: number };
  totals: {
    segments: number;
    lengthKm: number;
    crossings: number;
    lengthByClassKm: Record<TerrainClass, number>;
  };
  limitations: string[];
}

type Fc<P> = { type: "FeatureCollection"; revision: string; features: Array<{ type: "Feature"; geometry: unknown; properties: P }> };

export const getInfrastructureCatalog = () => get("/api/infrastructure") as Promise<InfrastructureCatalog>;

async function getLayer<P>(name: "roads" | "crossings" | "terrain"): Promise<Fc<P>> {
  const [catalog, data] = await Promise.all([getInfrastructureCatalog(), get(`/api/infrastructure/${name}`) as Promise<Fc<P>>]);
  if (data?.type !== "FeatureCollection" || data.revision !== catalog.revision)
    throw new RegionApiError(200, "INVALID_CONTRACT", `Camada ${name} incompatível com o catálogo.`);
  return data;
}

export const getRoads = () => getLayer<RoadSegment>("roads");
export const getCrossings = () => getLayer<Crossing>("crossings");
export const getTerrain = () => getLayer<{ id: string; class: 1 | 2 | 3; label: string; susceptibleFraction: number }>("terrain");
