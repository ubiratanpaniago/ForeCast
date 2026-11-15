import { afterEach, describe, expect, it, vi } from "vitest";
import { mockClimateData } from "../data/mockClimateData";
import {
  evidenceOf,
  valueColor,
  indicators,
} from "../components/Map/MapLayers";
import { parseTrendResult } from "./trendContract";
import type { MapQuery, IndicatorId } from "../types/geography";

const query: MapQuery = {
  layer: "trend",
  indicator: "PRCP_ANNUAL",
  start: 2001,
  end: 2024,
};
const fixture = () => structuredClone(mockClimateData(query)[0]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Contrato e leitura das evidências", () => {
  it("todos os indicadores preservam unidade, calendário e qualidade em cada recorte", () => {
    for (const indicator of Object.keys(indicators) as IndicatorId[]) {
      for (const [start, end] of [
        [2001, 2024],
        [2001, 2012],
        [2013, 2024],
      ]) {
        const current = { ...query, indicator, start, end };
        for (const result of mockClimateData(current)) {
          expect(() =>
            parseTrendResult(result, result.regionId, current),
          ).not.toThrow();
          if (end - start < 19)
            expect(result.statistics.status).not.toBe("valid");
        }
      }
    }
  });
  it("aceita os casos significativo, inconclusivo e exploratório sem misturá-los", () => {
    const results = mockClimateData(query).map((r) =>
      parseTrendResult(r, r.regionId, query),
    );
    expect(results.map(evidenceOf)).toEqual([
      "significant",
      "inconclusive",
      "exploratory",
    ]);
  });
  it("mantém ausência como null e não a transforma em taxa zero", () => {
    const soilQuery = { ...query, indicator: "SOIL_ROOT" as const };
    const result = mockClimateData(soilQuery)[2];
    expect(
      parseTrendResult(result, "43", soilQuery).statistics.slopePerDecade,
    ).toBeNull();
    expect(evidenceOf(result)).toBe("missing");
    expect(valueColor("trend", result, "SOIL_ROOT")).toBe("#333d39");
  });
  it("uma taxa zero com IC incluindo zero permanece válida e inconclusiva", () => {
    const result = fixture();
    Object.assign(result.statistics, {
      slopePerDecade: 0,
      pValue: 1,
      tau: 0,
      confidenceInterval95: [0, 0],
      direction: "inconclusive",
    });
    expect(
      parseTrendResult(result, "41", query).statistics.slopePerDecade,
    ).toBe(0);
    expect(evidenceOf(result)).toBe("inconclusive");
    expect(valueColor("trend", result, "PRCP_ANNUAL")).not.toBe("#333d39");
  });
  it("p pequeno sozinho não torna um resultado significativo", () => {
    const result = fixture();
    result.statistics.confidenceInterval95 = [-20, 100];
    expect(evidenceOf(result)).toBe("inconclusive");
    result.statistics.confidenceInterval95 = [20, 90];
    result.statistics.direction = "decreasing";
    expect(evidenceOf(result)).toBe("inconclusive");
  });
  it.each([
    "region",
    "period",
    "unit",
    "p",
    "ci",
    "series",
    "provenance",
  ] as const)("rejeita incompatibilidade em %s", (field) => {
    const result = fixture();
    if (field === "region") result.regionId = "42";
    if (field === "period") result.period.end = 2023;
    if (field === "unit") result.metadata.unit = "%";
    if (field === "p") result.statistics.pValue = 1.2;
    if (field === "ci") result.statistics.confidenceInterval95 = [90, 20];
    if (field === "series") result.series.pop();
    if (field === "provenance") result.metadata.demonstrative = false;
    expect(() => parseTrendResult(result, "41", query)).toThrow();
  });
});

describe("Fronteira REST do mapa", () => {
  it("usa trends com indicador e anos, sem cenários ou endpoints antigos", async () => {
    vi.stubEnv("VITE_DATA_MODE", "api");
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(fixture()), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { getTrendResults } = await import("./climateMapApi");
    const result = await getTrendResults(
      ["41"],
      query,
      new AbortController().signal,
    );
    expect(result[0].indicator).toBe("PRCP_ANNUAL");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/api/regions/41/trends?indicator=PRCP_ANNUAL&start=2001&end=2024",
    );
  });
  it("propaga indisponibilidade da API sem fallback silencioso para mock", async () => {
    vi.stubEnv("VITE_DATA_MODE", "api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    const { getTrendResults } = await import("./climateMapApi");
    await expect(
      getTrendResults(["41"], query, new AbortController().signal),
    ).rejects.toThrow("503");
  });
});
