import type { IndicatorId, LayerId, TrendResult } from "../../types/geography";
export const layerNames: Record<LayerId, string> = {
  trend: "Tendências históricas",
  neutral: "Divisões geográficas",
};
export const indicators: Record<
  IndicatorId,
  { name: string; unit: string; extent: number }
> = {
  PRCP_ANNUAL: { name: "Precipitação anual", unit: "mm", extent: 100 },
  RX1DAY: { name: "Máxima diária anual · RX1DAY", unit: "mm", extent: 10 },
  R50MM: { name: "Dias com chuva ≥ 50 mm · R50MM", unit: "dias", extent: 5 },
  SOIL_SURFACE: {
    name: "Umidade superficial · 0–10 cm",
    unit: "kg/m²",
    extent: 5,
  },
  SOIL_ROOT: { name: "Umidade da zona radicular", unit: "kg/m²", extent: 20 },
};
export type Evidence =
  "significant" | "inconclusive" | "exploratory" | "missing";
export function evidenceOf(result?: TrendResult): Evidence {
  if (
    !result ||
    result.statistics.status === "insufficient" ||
    result.statistics.slopePerDecade === null
  )
    return "missing";
  const {
    status,
    pValue,
    confidenceInterval95: ci,
    direction,
  } = result.statistics;
  if (status === "exploratory") return "exploratory";
  const coherentSign =
    result.statistics.slopePerDecade! > 0
      ? direction === "increasing" && ci !== null && ci[0] > 0
      : result.statistics.slopePerDecade! < 0 &&
        direction === "decreasing" &&
        ci !== null &&
        ci[1] < 0;
  return pValue !== null && pValue <= 0.05 && coherentSign
    ? "significant"
    : "inconclusive";
}
export function valueColor(
  layer: LayerId,
  result: TrendResult | undefined,
  indicator: IndicatorId,
) {
  if (layer === "neutral" || evidenceOf(result) === "missing") return "#333d39";
  const value = result!.statistics.slopePerDecade!;
  const ratio = Math.max(-1, Math.min(1, value / indicators[indicator].extent));
  const neutral = [165, 171, 163];
  const target = ratio < 0 ? [70, 157, 185] : [225, 161, 61];
  return `rgb(${neutral.map((n, i) => Math.round(n + (target[i] - n) * Math.abs(ratio))).join(",")})`;
}
