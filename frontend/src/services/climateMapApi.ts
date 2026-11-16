import type { TrendResult, MapQuery, RegionsGeoJSON } from "../types/geography";
import { mockClimateData } from "../data/mockClimateData";
import { parseTrendResult } from "./trendContract";
import { apiFetch } from "./apiFetch";
export const isMockMode = import.meta.env.VITE_DATA_MODE !== "api";
const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");
async function request(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await apiFetch(url, { signal, timeoutMs: 12000 });
  if (!response.ok)
    throw new Error(`Fonte indisponível (HTTP ${response.status}).`);
  return response.json();
}
export async function getRegions(signal: AbortSignal): Promise<RegionsGeoJSON> {
  const data = (await request(
    isMockMode ? "/data/south-regions.geojson" : `${baseUrl}/api/regions`,
    signal,
  )) as RegionsGeoJSON;
  if (
    !data ||
    data.type !== "FeatureCollection" ||
    !Array.isArray(data.features) ||
    !data.features.length ||
    data.features.some(
      (f) =>
        typeof f.properties?.id !== "string" ||
        !f.properties.id ||
        typeof f.properties.name !== "string" ||
        !["Polygon", "MultiPolygon"].includes(f.geometry?.type),
    ) ||
    new Set(data.features.map((f) => f.properties.id)).size !==
      data.features.length
  )
    throw new Error("GeoJSON de regiões inválido.");
  return data;
}
export async function getTrendResults(
  ids: string[],
  query: MapQuery,
  signal: AbortSignal,
): Promise<TrendResult[]> {
  if (query.layer === "neutral") return [];
  if (isMockMode) return mockClimateData(query);
  return Promise.all(
    ids.map(async (id) => {
      const params = new URLSearchParams({
        indicator: query.indicator,
        start: String(query.start),
        end: String(query.end),
      });
      return parseTrendResult(
        await request(
          `${baseUrl}/api/regions/${encodeURIComponent(id)}/trends?${params}`,
          signal,
        ),
        id,
        query,
      );
    }),
  );
}
