import type { MapQuery, TrendResult } from "../types/geography";
import { indicators } from "../components/Map/MapLayers";
export function parseTrendResult(
  input: unknown,
  regionId: string,
  query: MapQuery,
): TrendResult {
  if (!input || typeof input !== "object")
    throw new Error("Resposta de tendência inválida.");
  const data = input as TrendResult;
  const s = data.statistics;
  const m = data.metadata;
  const finite = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
  const nullable = (n: unknown) => n === null || finite(n);
  const ci = s?.confidenceInterval95;
  if (
    data.regionId !== regionId ||
    data.indicator !== query.indicator ||
    data.period?.start !== query.start ||
    data.period?.end !== query.end ||
    !Array.isArray(data.series) ||
    data.series.some(
      (p) =>
        !p ||
        !Number.isInteger(p.year) ||
        p.year < query.start ||
        p.year > query.end ||
        !nullable(p.value) ||
        (p.value !== null &&
          (p.value < 0 ||
            (query.indicator === "R50MM" &&
              (!Number.isInteger(p.value) || p.value > 366)))),
    ) ||
    data.series.length !== query.end - query.start + 1 ||
    data.series.some((p, i) => p.year !== query.start + i) ||
    !s ||
    !["valid", "exploratory", "insufficient"].includes(s.status) ||
    !["increasing", "decreasing", "inconclusive"].includes(s.direction) ||
    !nullable(s.slopePerDecade) ||
    !nullable(s.pValue) ||
    (s.pValue !== null && (s.pValue < 0 || s.pValue > 1)) ||
    !nullable(s.tau) ||
    (s.tau !== null && Math.abs(s.tau) > 1) ||
    !(
      ci === null ||
      (Array.isArray(ci) &&
        ci.length === 2 &&
        ci.every(finite) &&
        ci[0] <= ci[1])
    ) ||
    typeof s.method !== "string" ||
    !s.method ||
    !m ||
    m.unit !== indicators[query.indicator].unit ||
    typeof m.productId !== "string" ||
    typeof m.version !== "string" ||
    typeof m.sourceDOI !== "string" ||
    typeof m.demonstrative !== "boolean" ||
    !Array.isArray(m.qualityNotes) ||
    m.qualityNotes.some((n) => typeof n !== "string")
  )
    throw new Error("Resposta de tendência incompatível com o contrato.");
  if (
    (s.status === "valid" &&
      [s.slopePerDecade, s.pValue, s.tau, ci].some((v) => v === null)) ||
    (s.status === "insufficient" &&
      (s.direction !== "inconclusive" ||
        [s.slopePerDecade, s.pValue, s.tau, ci].some((v) => v !== null))) ||
    (ci !== null &&
      s.slopePerDecade !== null &&
      (s.slopePerDecade < ci[0] || s.slopePerDecade > ci[1]))
  )
    throw new Error("Estatísticas inconsistentes com o estado de qualidade.");
  if (
    !m.demonstrative &&
    (!m.sourceDOI.startsWith("10.") || !m.productId || !m.version)
  )
    throw new Error("Proveniência científica ausente.");
  if (s.status === "exploratory" && m.qualityNotes.length === 0)
    throw new Error("Resultado exploratório sem notas de qualidade.");
  if (
    (s.direction === "increasing" &&
      (s.slopePerDecade === null || s.slopePerDecade <= 0)) ||
    (s.direction === "decreasing" &&
      (s.slopePerDecade === null || s.slopePerDecade >= 0))
  )
    throw new Error("Direção incompatível com a inclinação.");
  return data;
}
