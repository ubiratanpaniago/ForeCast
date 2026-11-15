import { describe, expect, it } from "vitest";
import type { RegionsGeoJSON } from "../../types/geography";
import { fullMonth, placeName, rainDescription, rainSummary } from "./homeData";

describe("Leitura simples, sem alterar os dados científicos", () => {
  it("compara as mesmas células e preserva chuva zero", () => {
    expect(rainSummary([null, 0, 30], [100, 10, null])).toEqual({ value: 0, reference: 10, count: 1 });
    expect(rainSummary([null], [10])).toEqual({ value: null, reference: null, count: 0 });
  });
  it("explica aumento, redução e falta de referência sem inventar risco", () => {
    expect(rainDescription(50)).toBe("50% mais chuva que o habitual");
    expect(rainDescription(-100)).toBe("100% menos chuva que o habitual");
    expect(rainDescription(0)).toBe("Chuva igual à média histórica");
    expect(rainDescription(null)).toBe("Comparação indisponível");
    expect(fullMonth("2001-01")).toBe("Janeiro de 2001");
  });
  it("identifica a região aproximada e respeita buracos da geometria", () => {
    // Geometry is synthetic and used only for this unit test.
    const geo: RegionsGeoJSON = { type: "FeatureCollection", features: [{
      type: "Feature", properties: { id: "test", name: "Teste", abbreviation: "RS", level: "regiao_intermediaria" },
      geometry: { type: "Polygon", coordinates: [
        [[-53,-29],[-51,-29],[-51,-27],[-53,-27],[-53,-29]],
        [[-52.1,-28.1],[-51.9,-28.1],[-51.9,-27.9],[-52.1,-27.9],[-52.1,-28.1]],
      ] },
    }] };
    expect(placeName(geo,-52.4,-28.5)).toBe("Região de Teste");
    expect(placeName(geo,-52,-28)).toBe("Lugar escolhido no mapa");
    expect(placeName(null,-52,-28)).toBe("Lugar escolhido no mapa");
  });
});
