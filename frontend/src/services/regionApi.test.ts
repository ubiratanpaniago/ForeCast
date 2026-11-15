import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRegionCache, getRegionSummary, getRegionTrend, RegionApiError } from "./regionApi";

// Valores artificiais SOMENTE para testes de contrato, nunca servidos pela aplicação.
const period = { start: 2001, end: 2024 };
const metadata = {
  unit: "mm",
  productId: "GPM_3IMERGDF_07",
  version: "07",
  sourceDOI: "10.5067/GPM/IMERGDF/DAY/07",
  qualityNotes: ["teste"],
  demonstrative: false,
};
const statistics = {
  slopePerDecade: 2,
  pValue: 0.3,
  tau: 0.1,
  confidenceInterval95: [-1, 5] as [number, number],
  direction: "inconclusive" as const,
  status: "valid" as const,
  method: "Mann-Kendall",
};
const catalog = {
  revision: "r1",
  period,
  indicators: [{ id: "RX1DAY", name: "RX1DAY", unit: "mm", productId: "GPM_3IMERGDF_07" }],
  regions: [{ id: "4301", name: "Porto Alegre", abbreviation: "RS", level: "regiao_intermediaria" }],
};
const trend = {
  regionId: "4301",
  indicator: "RX1DAY",
  period,
  series: Array.from({ length: 24 }, (_, i) => ({ year: 2001 + i, value: 50 + i })),
  statistics,
  metadata,
};
const summary = { revision: "r1", indicator: "RX1DAY", period, metadata, regions: { "4301": statistics } };

let calls: string[];
function serve(routes: Record<string, { status?: number; body: unknown }>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      const path = url.replace("http://api.test", "");
      const r = routes[path] ?? { status: 404, body: { error: { code: "NOT_FOUND", message: "x" } } };
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  clearRegionCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("acesso aos dados regionais", () => {
  it("resumo de um indicador custa uma requisição, além do catálogo, e fica em cache", async () => {
    serve({ "/api/regions/catalog": { body: catalog }, "/api/regions/summary?indicator=RX1DAY": { body: summary } });
    await getRegionSummary("RX1DAY");
    await getRegionSummary("RX1DAY");
    expect(calls).toEqual(["http://api.test/api/regions/catalog", "http://api.test/api/regions/summary?indicator=RX1DAY"]);
  });

  it("série de uma região é validada pelo contrato de tendência", async () => {
    serve({
      "/api/regions/catalog": { body: catalog },
      "/api/regions/4301/trends?indicator=RX1DAY&start=2001&end=2024": { body: trend },
    });
    const t = await getRegionTrend("4301", "RX1DAY");
    expect(t.series).toHaveLength(24);

    clearRegionCache();
    serve({
      "/api/regions/catalog": { body: catalog },
      "/api/regions/4301/trends?indicator=RX1DAY&start=2001&end=2024": {
        body: { ...trend, statistics: { ...statistics, direction: "increasing", slopePerDecade: -2, confidenceInterval95: [-5, -1] } },
      },
    });
    await expect(getRegionTrend("4301", "RX1DAY")).rejects.toThrow("Direção incompatível");
  });

  it("resumo com revisão diferente do catálogo é rejeitado", async () => {
    serve({
      "/api/regions/catalog": { body: catalog },
      "/api/regions/summary?indicator=RX1DAY": { body: { ...summary, revision: "r2" } },
    });
    await expect(getRegionSummary("RX1DAY")).rejects.toMatchObject({ code: "INVALID_CONTRACT" });
  });

  it("erros da API mantêm o código do envelope e não ficam em cache", async () => {
    const down = { status: 503, body: { error: { code: "GRID_DATA_UNAVAILABLE", message: "x" } } };
    serve({ "/api/regions/catalog": down, "/api/regions/summary?indicator=RX1DAY": down });
    const err = await getRegionSummary("RX1DAY").catch((e) => e);
    expect(err).toBeInstanceOf(RegionApiError);
    expect(err).toMatchObject({ status: 503, code: "GRID_DATA_UNAVAILABLE" });
    serve({ "/api/regions/catalog": { body: catalog }, "/api/regions/summary?indicator=RX1DAY": { body: summary } });
    await expect(getRegionSummary("RX1DAY")).resolves.toMatchObject({ revision: "r1" });
  });
});
