import { describe, expect, it } from "vitest";
import { classify, fdrReading, interpretation, situation } from "./interpretation";
import type { TrendResult } from "../../../types/geography";

const stats = (o: Partial<TrendResult["statistics"]> = {}): TrendResult["statistics"] => ({
  slopePerDecade: 5,
  pValue: 0.01,
  tau: 0.4,
  confidenceInterval95: [1, 9],
  direction: "increasing",
  status: "valid",
  method: "MK",
  ...o,
});
const result = (s: TrendResult["statistics"]): TrendResult => ({
  regionId: "4301",
  indicator: "RX1DAY",
  period: { start: 2001, end: 2024 },
  series: Array.from({ length: 24 }, (_, i) => ({ year: 2001 + i, value: 100 })),
  statistics: s,
  metadata: { unit: "mm", productId: "X", version: "1", sourceDOI: "10.1/x", qualityNotes: [], demonstrative: false },
});

describe("classificação regional", () => {
  it("usa a direção do pipeline e a direção desfavorável do indicador", () => {
    expect(classify("RX1DAY", stats())).toBe("worsening");
    expect(classify("R50MM", stats({ direction: "decreasing", slopePerDecade: -1, confidenceInterval95: [-2, -0.5] }))).toBe("easing");
    expect(classify("SOIL_SURFACE", stats({ direction: "decreasing", slopePerDecade: -1 }))).toBe("decrease");
    expect(classify("PRCP_ANNUAL", stats())).toBe("increase");
  });

  it("p baixo sem direção do pipeline não vira tendência", () => {
    expect(classify("RX1DAY", stats({ pValue: 0.01, direction: "inconclusive" }))).toBe("no-trend");
    expect(classify("RX1DAY", stats({ status: "exploratory" }))).toBe("no-trend");
    expect(classify("RX1DAY", stats({ status: "insufficient", slopePerDecade: null }))).toBe("insufficient");
    expect(classify("RX1DAY", undefined)).toBe("insufficient");
  });

  it("situação prioriza agravamento", () => {
    expect(situation({ RX1DAY: "worsening", SOIL_SURFACE: "decrease" }).kind).toBe("worsening");
    expect(situation({ SOIL_SURFACE: "decrease", RX1DAY: "no-trend" }).kind).toBe("changes");
    expect(situation({ RX1DAY: "no-trend" }).kind).toBe("no-trend");
    expect(situation({}).kind).toBe("insufficient");
  });

  it("texto cita inclinação, % da média e p", () => {
    const t = interpretation("RX1DAY", result(stats()), "worsening");
    expect(t).toContain("+5,0 mm/década");
    expect(t).toContain("+5,0% da média");
    expect(t).toContain("p = 0,010");
  });
});

describe("leitura do FDR por célula", () => {
  it("nenhuma célula após FDR, mas p bruto acima do acaso", () => {
    const r = fdrReading({ cells: 200, increasing: 0, decreasing: 0, inconclusive: 200, raw_p_below_005: 30, no_data: 0 }, 0.1)!;
    expect(r.significant).toBe(0);
    expect(r.expectedByChance).toBe(10);
    expect(r.text).toContain("Nenhuma das 200 células de 0,1°");
    expect(r.text).toContain("bem acima dos ~10 esperados");
  });

  it("células significativas e sem dado", () => {
    const r = fdrReading({ cells: 50, increasing: 2, decreasing: 0, inconclusive: 40, raw_p_below_005: 3, no_data: 8 }, 0.25)!;
    expect(r.tested).toBe(42);
    expect(r.text).toContain("2 de 42 células de 0,25° mantêm tendência de aumento");
  });

  it("região sem células", () => {
    expect(fdrReading(undefined, 0.1)).toBeNull();
  });
});
