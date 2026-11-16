// Regras de leitura dos resultados regionais. A estatística vem pronta do pipeline
// (Mann-Kendall, Theil-Sen, IC 95 %, FDR por célula); aqui só se escolhem palavras e cores.
import type { IndicatorId, TrendResult } from "../../../types/geography";
import type { CellFdrCounts } from "../../../services/regionApi";

export const REGIONAL_INDICATORS: IndicatorId[] = ["RX1DAY", "R50MM", "PRCP_ANNUAL", "SOIL_SURFACE"];

export const INDICATOR_INFO: Record<
  string,
  { label: string; short: string; unit: string; question: string; hazard: "up" | "none"; decimals: number; product: string }
> = {
  RX1DAY: {
    label: "Maior chuva diária do ano",
    short: "RX1DAY",
    unit: "mm",
    question: "Os maiores acumulados diários estão aumentando?",
    hazard: "up",
    decimals: 1,
    product: "GPM IMERG Final diário V07 · 0,1°",
  },
  R50MM: {
    label: "Dias com chuva ≥ 50 mm",
    short: "R50MM",
    unit: "dias",
    question: "Dias de chuva muito forte estão mais frequentes?",
    hazard: "up",
    decimals: 2,
    product: "GPM IMERG Final diário V07 · 0,1°",
  },
  PRCP_ANNUAL: {
    label: "Precipitação anual",
    short: "PRCP",
    unit: "mm",
    question: "O total de chuva do ano está mudando?",
    hazard: "none",
    decimals: 0,
    product: "GPM IMERG Final mensal V07 · 0,1°",
  },
  SOIL_SURFACE: {
    label: "Umidade do solo 0–10 cm",
    short: "Solo",
    unit: "kg/m²",
    question: "A água armazenada na camada superficial está mudando?",
    hazard: "none",
    decimals: 2,
    product: "GLDAS Noah mensal V2.1 · 0,25° · modelado",
  },
};

export type TrendClass = "worsening" | "easing" | "increase" | "decrease" | "no-trend" | "insufficient";

export const CLASS_LABEL: Record<TrendClass, string> = {
  worsening: "Agravamento detectado",
  easing: "Redução detectada",
  increase: "Aumento significativo",
  decrease: "Redução significativa",
  "no-trend": "Sem tendência significativa",
  insufficient: "Dados insuficientes",
};

export const CLASS_HINT: Record<TrendClass, string> = {
  worsening: "Tendência significativa na direção desfavorável (mais chuva extrema).",
  easing: "Tendência significativa na direção oposta à desfavorável.",
  increase: "Aumento significativo; o indicador não tem uma direção desfavorável única.",
  decrease: "Redução significativa; o indicador não tem uma direção desfavorável única.",
  "no-trend": "A evidência não basta para afirmar mudança monotônica — não significa estabilidade.",
  insufficient: "Não há dados suficientes para concluir.",
};

export const CLASS_COLOR: Record<TrendClass, string> = {
  worsening: "#b42318",
  easing: "#3d6a9e",
  increase: "#2f8a8c",
  decrease: "#b07a3c",
  "no-trend": "#ddd5c4",
  insufficient: "#c9c2b3",
};

/** Usa a direção já decidida pelo pipeline (p < 0,05 e IC 95 % sem o zero). */
export function classify(indicator: IndicatorId, r: TrendResult["statistics"] | undefined): TrendClass {
  if (!r || r.status === "insufficient" || r.slopePerDecade === null) return "insufficient";
  if (r.direction === "inconclusive" || r.status === "exploratory") return "no-trend";
  const up = r.direction === "increasing";
  if (INDICATOR_INFO[indicator]?.hazard === "up") return up ? "worsening" : "easing";
  return up ? "increase" : "decrease";
}

export const isSignificant = (c: TrendClass) => !["no-trend", "insufficient"].includes(c);

export function classesFor(indicator: IndicatorId): TrendClass[] {
  return INDICATOR_INFO[indicator]?.hazard === "up"
    ? ["worsening", "easing", "no-trend", "insufficient"]
    : ["increase", "decrease", "no-trend", "insufficient"];
}

const num = (v: number, d: number, locale = "pt-BR") =>
  v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
export const signed = (v: number, d: number, locale = "pt-BR") => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v), d, locale)}`;
export const formatP = (p: number | null, locale = "pt-BR") => (p === null ? "—" : p < 0.001 ? `p < ${locale === "en-US" ? "0.001" : "0,001"}` : `p = ${num(p, 3, locale)}`);

export function slopeText(indicator: IndicatorId, s: TrendResult["statistics"], locale = "pt-BR", decadeLabel = "década") {
  const info = INDICATOR_INFO[indicator];
  if (s.slopePerDecade === null) return "—";
  return `${signed(s.slopePerDecade, info.decimals, locale)} ${info.unit}/${decadeLabel}`;
}

export function ciText(indicator: IndicatorId, s: TrendResult["statistics"], locale = "pt-BR", rangeSeparator = "a") {
  const ci = s.confidenceInterval95;
  if (!ci) return "—";
  const d = INDICATOR_INFO[indicator].decimals;
  return `${signed(ci[0], d, locale)} ${rangeSeparator} ${signed(ci[1], d, locale)}`;
}

/** Média da série (para expressar a inclinação em % por década). */
export function seriesMean(series: TrendResult["series"]) {
  const v = series.map((p) => p.value).filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export interface Situation {
  kind: "worsening" | "changes" | "no-trend" | "insufficient";
  text: string;
}

export function situation(byIndicator: Partial<Record<IndicatorId, TrendClass>>): Situation {
  const label = (ids: IndicatorId[]) => ids.map((i) => INDICATOR_INFO[i].label.toLowerCase()).join(", ");
  const worse = REGIONAL_INDICATORS.filter((i) => byIndicator[i] === "worsening");
  if (worse.length) return { kind: "worsening", text: `Evidência de agravamento em ${label(worse)}.` };
  if (REGIONAL_INDICATORS.every((i) => !byIndicator[i] || byIndicator[i] === "insufficient"))
    return { kind: "insufficient", text: "Dados insuficientes para uma conclusão." };
  const changed = REGIONAL_INDICATORS.filter((i) => byIndicator[i] && isSignificant(byIndicator[i]!));
  if (changed.length)
    return { kind: "changes", text: `Mudança significativa sem agravamento dos extremos: ${label(changed)}.` };
  return { kind: "no-trend", text: "Nenhuma tendência significativa detectada em 2001–2024." };
}

/** Frase fixa por classe; números da API. */
export function interpretation(indicator: IndicatorId, r: TrendResult, cls: TrendClass): string {
  const info = INDICATOR_INFO[indicator];
  const subject = info.label.toLowerCase();
  const s = r.statistics;
  if (cls === "insufficient") return `Sem conclusão para ${subject}: dados insuficientes.`;
  const mean = seriesMean(r.series);
  const rel = mean && s.slopePerDecade !== null ? ` (${signed((s.slopePerDecade / mean) * 100, 1)}% da média por década)` : "";
  if (cls === "no-trend")
    return `A inclinação estimada para ${subject} é ${slopeText(indicator, s)}${rel}, com ${formatP(s.pValue)} e intervalo de confiança que inclui o zero: os dados não permitem afirmar que mudou.`;
  const verb = s.direction === "increasing" ? "aumentou" : "diminuiu";
  return `Em 2001–2024, ${subject} ${verb} ${slopeText(indicator, s)}${rel}, com ${formatP(s.pValue)} e IC 95 % que exclui o zero.`;
}

export interface FdrReading {
  significant: number;
  tested: number;
  rawP: number;
  expectedByChance: number;
  text: string;
}

/** Leitura das células da região após FDR, comparando o p bruto com o esperado ao acaso (5 %). */
export function fdrReading(c: CellFdrCounts | undefined, resolution: number): FdrReading | null {
  if (!c || c.cells === 0) return null;
  const tested = c.cells - c.no_data;
  const significant = c.increasing + c.decreasing;
  const expected = Math.round(tested * 0.05);
  const res = String(resolution).replace(".", ",");
  let text: string;
  if (significant > 0) {
    const dir = c.increasing && c.decreasing ? "em direções diferentes" : c.increasing ? "de aumento" : "de redução";
    text = `${significant} de ${tested} células de ${res}° mantêm tendência ${dir} após a correção FDR.`;
  } else {
    text = `Nenhuma das ${tested} células de ${res}° mantém tendência após a correção FDR entre todas as células do Sul.`;
  }
  const ratio = expected ? c.raw_p_below_005 / expected : 0;
  text +=
    c.raw_p_below_005 === 0
      ? " Nenhuma tem p < 0,05 mesmo sem correção."
      : ` Sem correção, ${c.raw_p_below_005} têm p < 0,05 — ${
          ratio >= 2 ? "bem acima" : ratio > 1.2 ? "acima" : ratio >= 0.8 ? "perto" : "abaixo"
        } dos ~${expected} esperados só por acaso.`;
  return { significant, tested, rawP: c.raw_p_below_005, expectedByChance: expected, text };
}
