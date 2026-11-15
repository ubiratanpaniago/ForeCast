import { describe, expect, it } from "vitest";
import snapshot from "../../../../public/data/snapshot.json";
import { compareYears, monthlyCoverage } from "./comparison";
describe("Comparação descritiva", () => {
  it("compara os totais regionais e usa o segundo ano como denominador", () => {
    const value = compareYears(snapshot, 2024, 2020);
    const a = snapshot.annual.regional["2024"],
      b = snapshot.annual.regional["2020"];
    expect(value.delta).toBeCloseTo(a - b);
    expect(value.percent).toBeCloseTo(((a - b) / b) * 100);
  });
  it("não confunde variação entre anos com anomalia contra climatologia", () => {
    const value = compareYears(snapshot, 2024, 2020);
    expect(value.currentAnomaly).toBeCloseTo(
      ((snapshot.annual.regional["2024"] -
        snapshot.annual.regionalClimatology) /
        snapshot.annual.regionalClimatology) *
        100,
    );
    expect(value.percent).not.toBe(value.currentAnomaly);
  });
  it("usa a mesma posição de bloco nos dois anos e na climatologia", () => {
    const value = compareYears(snapshot, 2024, 2001, [2, 3]);
    const index = 2 * snapshot.grid.lon.length + 3;
    expect(value.current).toBe(snapshot.annual.byYear["2024"][index]);
    expect(value.reference).toBe(snapshot.annual.byYear["2001"][index]);
  });
  it("mesmo ano produz diferença zero", () => {
    expect(compareYears(snapshot, 2015, 2015).delta).toBe(0);
    expect(compareYears(snapshot, 2015, 2015).percent).toBe(0);
  });
  it("referência zero não produz porcentagem infinita", () => {
    const data = structuredClone(snapshot);
    data.annual.regional["2001"] = 0;
    const value = compareYears(data, 2024, 2001);
    expect(value.reference).toBe(0);
    expect(value.percent).toBeNull();
  });
  it("meses ausentes continuam ausentes na contagem de cobertura", () => {
    const data = structuredClone(snapshot);
    data.monthly.soilMoisture = data.monthly.soilMoisture.filter(
      (p) => !p.t.startsWith("2001-"),
    );
    expect(
      monthlyCoverage(data, "soilMoisture").find((y) => y.year === 2001)?.valid,
    ).toBe(0);
    expect(
      monthlyCoverage(data, "precipitation").every((y) => y.valid === 12),
    ).toBe(true);
  });
});
