import type { IndicatorId } from "../../../types/geography";
import type { CellFdr, CellFdrCounts, RegionInfo, RegionSummary } from "../../../services/regionApi";
import { useRegionTrend, type Loadable } from "../../../hooks/useRegionalTrends";
import { useLanguage } from "../../../i18n/LanguageContext";
import {
  CLASS_COLOR,
  CLASS_HINT,
  CLASS_LABEL,
  INDICATOR_INFO,
  REGIONAL_INDICATORS,
  ciText,
  classify,
  fdrReading,
  formatP,
  interpretation,
  isSignificant,
  signed,
  situation,
  slopeText,
  type TrendClass,
} from "../lib/interpretation";
import { TrendChart } from "./TrendChart";
import { State } from "./State";

interface Props {
  region: RegionInfo;
  indicator: IndicatorId;
  onIndicator: (id: IndicatorId) => void;
  summaries: Partial<Record<IndicatorId, Loadable<RegionSummary>>>;
  cellFdr: Loadable<CellFdr>;
  onClose: () => void;
}

function fdrEnglishText(
  counts: CellFdrCounts | undefined,
  resolution: number,
  reading: NonNullable<ReturnType<typeof fdrReading>>,
) {
  const tested = reading.tested;
  const significant = reading.significant;
  const expected = reading.expectedByChance;
  const raw = reading.rawP;
  const resolutionText = resolution.toLocaleString("en-US");
  let summary: string;
  if (significant > 0) {
    const direction = counts && counts.increasing && counts.decreasing
      ? "in both directions"
      : counts && counts.increasing
        ? "in the increasing direction"
        : "in the decreasing direction";
    summary = `${significant} of ${tested} cells at ${resolutionText}° retain a trend ${direction} after FDR correction.`;
  } else {
    summary = `None of the ${tested} cells at ${resolutionText}° retain a trend after FDR correction across all cells in the South.`;
  }
  if (raw === 0) return `${summary} None have p < 0.05 before correction.`;
  const relation = expected
    ? raw / expected >= 2 ? "well above" : raw / expected > 1.2 ? "above" : raw / expected >= 0.8 ? "close to" : "below"
    : "above";
  return `${summary} Before correction, ${raw} have p < 0.05 — ${relation} the approximately ${expected} expected by chance alone.`;
}

export function Badge({ cls }: { cls: TrendClass }) {
  const { t } = useLanguage();
  return (
    <span className={`rg-badge rg-badge--${cls}`} title={t(CLASS_HINT[cls])}>
      <i style={{ background: CLASS_COLOR[cls] }} aria-hidden />
      {t(CLASS_LABEL[cls])}
    </span>
  );
}

/** Diagnóstico de uma região: conclusão, indicadores, gráfico, FDR por célula e limitações. */
export function DiagnosisPanel({ region, indicator, onIndicator, summaries, cellFdr, onClose }: Props) {
  const { t, language } = useLanguage();
  const locale = language === "en" ? "en-US" : "pt-BR";
  const classes = Object.fromEntries(
    REGIONAL_INDICATORS.map((i) => {
      const s = summaries[i];
      return [i, s?.status === "ready" ? classify(i, s.data.regions[region.id]) : undefined];
    }),
  ) as Partial<Record<IndicatorId, TrendClass>>;
  const allReady = REGIONAL_INDICATORS.every((i) => summaries[i]?.status === "ready");
  const sit = allReady ? situation(classes) : null;
  const trend = useRegionTrend(region.id, indicator);
  const info = INDICATOR_INFO[indicator];
  const situationText = !sit ? "" : language === "en"
    ? sit.kind === "worsening"
      ? `Evidence of worsening in ${REGIONAL_INDICATORS.filter((i) => classes[i] === "worsening").map((i) => t(INDICATOR_INFO[i].label).toLowerCase()).join(", ")}.`
      : sit.kind === "insufficient"
        ? "Insufficient data for a conclusion."
        : sit.kind === "changes"
          ? `Significant change without worsening in extreme indicators: ${REGIONAL_INDICATORS.filter((i) => classes[i] && isSignificant(classes[i]!)).map((i) => t(INDICATOR_INFO[i].label).toLowerCase()).join(", ")}.`
          : "No significant trend detected in 2001–2024."
    : sit.text;

  const trendDescription = (r: import("../../../types/geography").TrendResult, cls: TrendClass) => {
    if (language === "pt") return interpretation(indicator, r, cls);
    const s = r.statistics;
    const subject = t(info.label).toLowerCase();
    const slope = slopeText(indicator, s, locale, "decade");
    const p = formatP(s.pValue, locale);
    const mean = r.series.map((point) => point.value).filter((value): value is number => value !== null);
    const average = mean.length ? mean.reduce((a, b) => a + b, 0) / mean.length : null;
    const relative = average && s.slopePerDecade !== null
      ? ` (${signed((s.slopePerDecade / average) * 100, 1, locale)}% of the average per decade)`
      : "";
    if (cls === "insufficient") return `No conclusion for ${subject}: insufficient data.`;
    if (cls === "no-trend")
      return `The estimated slope for ${subject} is ${slope}${relative}, with ${p} and a confidence interval including zero; the data do not support a conclusion of change.`;
    const verb = s.direction === "increasing" ? "increased" : "decreased";
    return `From 2001 to 2024, ${subject} ${verb} by ${slope}${relative}, with ${p} and a 95% confidence interval excluding zero.`;
  };

  return (
    <section className="rg-panel" aria-label={`${t("Diagnóstico de")} ${region.name}`}>
      <header className="rg-panel-head">
        <div>
          <p className="eyebrow">{region.level === "estado" ? t("Estado") : `${t("Região intermediária")} · ${region.abbreviation}`}</p>
          <h2>{region.name}</h2>
        </div>
        <button className="rg-x" onClick={onClose} aria-label={t("Fechar diagnóstico")}>
          ×
        </button>
      </header>

      {sit ? (
        <div className={`rg-situation rg-situation--${sit.kind}`}>
          <p className="rg-situation-text">{situationText}</p>
          <p className="muted">{t("Evidência de mudança no perigo hidrometeorológico, 2001–2024. Não é risco de desastre.")}</p>
        </div>
      ) : (
        <p className="muted">{t("Carregando a classificação dos indicadores…")}</p>
      )}

      <table className="rg-table">
        <thead>
          <tr>
            <th scope="col">{t("Indicador")}</th>
            <th scope="col">{t("Classificação")}</th>
            <th scope="col">Theil-Sen</th>
            <th scope="col">MK (p)</th>
          </tr>
        </thead>
        <tbody>
          {REGIONAL_INDICATORS.map((i) => {
            const st = summaries[i]?.status === "ready" ? (summaries[i] as { data: RegionSummary }).data.regions[region.id] : undefined;
            return (
              <tr key={i} className={i === indicator ? "is-active" : ""}>
                <th scope="row">
                  <button className="rg-link" onClick={() => onIndicator(i)} aria-pressed={i === indicator}>
                    {t(INDICATOR_INFO[i].label)}
                  </button>
                </th>
                <td>{classes[i] ? <Badge cls={classes[i]!} /> : "…"}</td>
                <td className="mono">{st ? slopeText(i, st, locale, t("década")) : "—"}</td>
                <td className="mono">{st ? formatP(st.pValue, locale) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="rg-h">{t(info.label)}</h3>
      <p className="muted rg-q">
        {t(info.question)} <span className="mono">· {t(info.product)}</span>
      </p>
      <State state={trend} what={t("série histórica")}>
        {(r) => {
          const cls = classify(indicator, r.statistics);
          const s = r.statistics;
          return (
            <>
              <TrendChart result={r} unit={t(info.unit)} decimals={info.decimals} significant={isSignificant(cls)} />
              <p className="rg-interp">{trendDescription(r, cls)}</p>
              <dl className="rg-stats mono">
                <dt>Theil-Sen</dt>
                <dd>{slopeText(indicator, s, locale, t("década"))}</dd>
                <dt>{t("IC 95 %")}</dt>
                <dd>{ciText(indicator, s, locale, t("a"))}</dd>
                <dt>τ de Kendall</dt>
                <dd>{s.tau === null ? "—" : signed(s.tau, 2, locale)}</dd>
                <dt>{t("p bruto")}</dt>
                <dd>{formatP(s.pValue, locale)}</dd>
              </dl>
              <details className="rg-details">
                <summary>{t("Método e notas de qualidade")}</summary>
                <p className="mono">{s.method}</p>
                <ul>
                  {r.metadata.qualityNotes.map((n) => (
                    <li key={n}>{t(n)}</li>
                  ))}
                </ul>
                <p className="mono muted">
                  {r.metadata.productId} v{r.metadata.version} · DOI{" "}
                  <a href={`https://doi.org/${r.metadata.sourceDOI}`} target="_blank" rel="noreferrer">
                    {r.metadata.sourceDOI}
                  </a>
                </p>
              </details>
            </>
          );
        }}
      </State>

      <h3 className="rg-h">{t("Células dentro da região, após FDR")}</h3>
      <State state={cellFdr} what={t("resultados por célula")} compact>
        {(d) => {
          const r = fdrReading(d.regions[region.id], d.resolutionDegrees);
          if (!r) return <p className="muted">{t("Nenhuma célula com centro dentro desta região.")}</p>;
          return (
            <>
              <p className="rg-fdr">{language === "en" ? fdrEnglishText(d.regions[region.id], d.resolutionDegrees, r) : r.text}</p>
              <div className="rg-fdr-bar" aria-hidden>
                <span className="is-raw" style={{ width: `${(r.rawP / r.tested) * 100}%` }} />
                <span className="is-chance" style={{ left: `${(r.expectedByChance / r.tested) * 100}%` }} />
              </div>
              <p className="muted rg-small">
                {t("Barra: fração das células com p < 0,05 sem correção; o traço marca 5 %, o esperado ao acaso. A correção Benjamini-Hochberg (q = 0,05) foi aplicada pelo pipeline entre as")} {d.cellsTested.toLocaleString(locale)} {t("células do indicador.")}
              </p>
            </>
          );
        }}
      </State>

      <h3 className="rg-h">{t("O que estes dados não permitem afirmar")}</h3>
      <ul className="rg-limits">
        <li>{t("Risco de enchente ou de desastre: faltam exposição, vulnerabilidade, relevo detalhado e drenagem.")}</li>
        <li>{t("Causa da mudança: 24 anos não separam tendência de longo prazo de variabilidade (El Niño/La Niña).")}</li>
        <li>{t("Resultado regional sem correção para testes múltiplos: com 24 áreas e 4 indicadores, alguns p < 0,05 surgem por acaso.")}</li>
        {indicator === "SOIL_SURFACE" && <li>{t("Umidade do solo é saída do modelo GLDAS, não medição.")}</li>}
      </ul>
    </section>
  );
}
