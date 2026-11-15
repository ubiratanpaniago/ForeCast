import type { MapQuery, TrendResult } from "../types/geography";
import { indicators } from "../components/Map/MapLayers";
// Fixtures de apresentação: nenhuma estatística é estimada a partir destas séries.
// Não utilizar estes números em qualquer análise científica.
export function mockClimateData(query: MapQuery): TrendResult[] {
  return ["41", "42", "43"].map((regionId, index) => {
    const factor = indicators[query.indicator].extent;
    const slope = [0.6, -0.4, 0.2][index] * factor;
    const baseline = {
      PRCP_ANNUAL: 1500,
      RX1DAY: 90,
      R50MM: 7,
      SOIL_SURFACE: 24,
      SOIL_ROOT: 260,
    }[query.indicator];
    const insufficient = query.indicator === "SOIL_ROOT" && index === 2;
    const shortPeriod = query.end - query.start + 1 < 20;
    return {
      regionId,
      indicator: query.indicator,
      period: { start: query.start, end: query.end },
      series: Array.from(
        { length: query.end - query.start + 1 },
        (_, offset) => ({
          year: query.start + offset,
          value:
            insufficient || (index === 2 && offset % 6 === 0)
              ? null
              : Number(
                  (
                    baseline +
                    (slope * offset) / 10 +
                    (Math.sin(offset * 2) * factor) / 4
                  ).toFixed(query.indicator === "R50MM" ? 0 : 2),
                ),
        }),
      ),
      statistics: {
        slopePerDecade: insufficient ? null : slope,
        pValue: insufficient ? null : [0.012, 0.31, 0.04][index],
        tau: insufficient ? null : [0.43, -0.12, 0.25][index],
        confidenceInterval95: insufficient
          ? null
          : index === 0
            ? [factor * 0.2, factor * 0.9]
            : index === 1
              ? [-factor * 0.8, factor * 0.3]
              : [factor * 0.05, factor * 0.4],
        direction: insufficient || index === 1 ? "inconclusive" : "increasing",
        status: insufficient
          ? "insufficient"
          : index === 2 || shortPeriod
            ? "exploratory"
            : "valid",
        method: "Fixture de interface; não calculado por Mann-Kendall ou Sen",
      },
      metadata: {
        unit: indicators[query.indicator].unit,
        productId: "SYNTHETIC_UI_FIXTURE",
        version: "1",
        sourceDOI: "",
        demonstrative: true,
        qualityNotes: [
          ...(shortPeriod
            ? ["Recorte curto: exemplo tratado como exploratório."]
            : []),
          "Série e estatísticas sintéticas independentes, sem validade científica.",
          "Estados usados somente para demonstrar a interface; regiões-piloto ainda não definidas.",
          ...(index === 2
            ? ["Exemplo de lacunas e resultado exploratório."]
            : []),
          ...(insufficient
            ? ["Exemplo de dados insuficientes; estatísticas indisponíveis."]
            : []),
        ],
      },
    };
  });
}
