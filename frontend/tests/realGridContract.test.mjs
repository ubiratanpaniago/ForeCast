import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseGridCells, parseCellDetail } from "../src/services/gridApi";

const root = new URL("../../backend/data/derived/grids/", import.meta.url);
function read(path) {
  return JSON.parse(readFileSync(new URL(path, root), "utf8"));
}

it.skipIf(!existsSync(new URL("catalog.json", root)))("aceita as duas grades NASA reais no contrato usado pelo navegador", () => {
  const catalog = read("catalog.json").grids;
  for (const grid of catalog.filter(g => g.available)) {
    const period = grid.period;
    const indicator = grid.indicators[0];
    const data = read(`${grid.id}/series.json`);
    const source = read(`${grid.id}/cells.geojson`);
    const input = { ...source, gridId: grid.id, revision: grid.revision, indicator, period, truncated: false };
    const cells = parseGridCells(input, grid, indicator, period);
    expect(cells.features.length).toBeGreaterThan(100);
    const id = cells.features[0].properties.id;
    const detail = { gridId: grid.id, revision: data.revision, cellId: id, indicator, period,
      series: data.years.map((year, i) => ({ year, value: data.cells[id].values[i] })),
      statistics: null, metadata: data.metadata };
    expect(parseCellDetail(detail, grid, id, indicator, period)).toBe(detail);
  }
});
