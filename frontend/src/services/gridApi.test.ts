import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGridCells, parseCellDetail } from "./gridApi";
import type { GridCells, GridDefinition, CellDetail } from "../types/grid";
// Geometria e valores artificiais SOMENTE para testes de contrato, nunca servidos pela aplicação.
const grid: GridDefinition = {
  id: "test-grid",
  name: "Unit test",
  productId: "TEST",
  version: "1",
  resolutionDegrees: 0.1,
  crs: "EPSG:4326",
  indicators: ["PRCP_ANNUAL"],
  period: { start: 2001, end: 2002 },
  revision: "r1",
  available: true,
};
const period = { start: 2001, end: 2002 };
function cells(): GridCells {
  return {
    type: "FeatureCollection",
    gridId: grid.id,
    revision: "r1",
    indicator: "PRCP_ANNUAL",
    period,
    truncated: false,
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-50, -28],
              [-49.9, -28],
              [-49.9, -27.9],
              [-50, -27.9],
              [-50, -28],
            ],
          ],
        },
        properties: {
          id: "native-row-column",
          gridId: grid.id,
          row: 1,
          column: 2,
          center: [-49.95, -27.95],
          bounds: [-50, -28, -49.9, -27.9],
          fractionInside: 0.5,
          summary: null,
        },
      },
    ],
  };
}
function detail(): CellDetail {
  return {
    gridId: grid.id,
    revision: "r1",
    cellId: "native-row-column",
    indicator: "PRCP_ANNUAL",
    period,
    series: [
      { year: 2001, value: 0 },
      { year: 2002, value: null },
    ],
    statistics: null,
    metadata: {
      unit: "mm",
      productId: "TEST",
      version: "1",
      sourceDOI: "10.test/unit-test",
      qualityNotes: ["Somente teste"],
      demonstrative: false,
    },
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("Grades nativas", () => {
  it("preserva geometria e identificador sem gerar ou interpolar células", () => {
    const source = cells();
    expect(parseGridCells(source, grid, "PRCP_ANNUAL", period)).toBe(source);
  });
  it("aceita recorte vazio sem inventar células", () => {
    const source = cells();
    source.features = [];
    expect(
      parseGridCells(source, grid, "PRCP_ANNUAL", period).features,
    ).toHaveLength(0);
  });
  it.each([
    "resolution",
    "product",
    "revision",
    "duplicate",
    "truncated",
    "geometry",
  ] as const)("rejeita %s incompatível", (field) => {
    const source = cells();
    if (field === "resolution")
      source.features[0].properties.bounds[2] = -49.75;
    if (field === "product") source.gridId = "gldas";
    if (field === "revision") source.revision = "r2";
    if (field === "duplicate")
      source.features.push(structuredClone(source.features[0]));
    if (field === "truncated") source.truncated = true;
    if (field === "geometry")
      source.features[0].geometry.coordinates[0][1] = [-49.8, -28];
    expect(() => parseGridCells(source, grid, "PRCP_ANNUAL", period)).toThrow();
  });
  it("permite séries anuais reais antes do motor estatístico e distingue zero de ausência", () => {
    const result = parseCellDetail(
      detail(),
      grid,
      "native-row-column",
      "PRCP_ANNUAL",
      period,
    );
    expect(result.statistics).toBeNull();
    expect(result.series.map((p) => p.value)).toEqual([0, null]);
  });
  it("rejeita série de outra célula ou revisão", () => {
    const source = detail();
    source.revision = "r2";
    expect(() =>
      parseCellDetail(source, grid, source.cellId, "PRCP_ANNUAL", period),
    ).toThrow();
  });
  it("busca somente a série da célula solicitada", async () => {
    vi.stubEnv("VITE_GRID_MODE", "api");
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(detail()), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { getCellDetail } = await import("./gridApi");
    await getCellDetail(
      grid,
      "native-row-column",
      "PRCP_ANNUAL",
      period,
      new AbortController().signal,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/api/grids/test-grid/cells/native-row-column/timeseries?indicator=PRCP_ANNUAL&start=2001&end=2002",
    );
  });
  it("informa falha HTTP sem substituir o recorte por mock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    const { getGridCells } = await import("./gridApi");
    await expect(
      getGridCells(grid, "PRCP_ANNUAL", period, new AbortController().signal),
    ).rejects.toThrow("503");
  });
});
