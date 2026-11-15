import { describe, expect, it } from "vitest";
import snapshot from "../../../../public/data/snapshot.json";
import { parseSnapshot } from "./snapshotContract";
import { anomalyPct, readCell } from "../hooks/useRegionData";
describe("Snapshot fornecido pela equipe de dados", () => {
  it("carrega o arquivo real sem alterar resolução ou valores", () => {
    const data = parseSnapshot(snapshot);
    expect(data).toBe(snapshot);
    expect(data.grid.res).toBe(0.2);
    expect(data.years).toHaveLength(24);
    expect(data.monthly.precipitation).toHaveLength(288);
  });
  it("consulta a posição correta na matriz anual", () => {
    const data = parseSnapshot(snapshot);
    const cell = readCell(
      data,
      Array(data.grid.lat.length * data.grid.lon.length).fill(true),
      2001,
      2,
      3,
    );
    expect(cell.total).toBe(
      data.annual.byYear["2001"][2 * data.grid.lon.length + 3],
    );
    expect(cell.lat).toBe(data.grid.lat[2]);
    expect(cell.anomalyPct).toBe(anomalyPct(cell.total, cell.climatology));
  });
  it.each(["missing", "negative", "duplicate", "geometry"] as const)(
    "rejeita %s em vez de exibir um resultado incorreto",
    (kind) => {
      const data = structuredClone(snapshot);
      if (kind === "missing") data.monthly.precipitation.pop();
      if (kind === "negative") data.annual.byYear["2001"][0] = -9999;
      if (kind === "duplicate") data.years[1] = data.years[0];
      if (kind === "geometry") data.grid.res = 0.1;
      expect(() => parseSnapshot(data)).toThrow("Snapshot inválido");
    },
  );
  it("aceita umidade sem meses disponíveis sem criar zeros", () => {
    const data = structuredClone(snapshot);
    data.monthly.soilMoisture = [];
    expect(parseSnapshot(data).monthly.soilMoisture).toHaveLength(0);
  });
});
