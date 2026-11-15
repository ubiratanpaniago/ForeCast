import type { IndicatorId } from "../../../types/geography";
import type { CellFdr, RegionInfo, RegionSummary } from "../../../services/regionApi";
import { useRegionTrend, type Loadable } from "../../../hooks/useRegionalTrends";
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

export function Badge({ cls }: { cls: TrendClass }) {
  return (
    <span className={`rg-badge rg-badge--${cls}`} title={CLASS_HINT[cls]}>
      <i style={{ background: CLASS_COLOR[cls] }} aria-hidden />
      {CLASS_LABEL[cls]}
    </span>
  );
}

/** Diagnóstico de uma região: conclusão, indicadores, gráfico, FDR por célula e limitações. */
export function DiagnosisPanel({ region, indicator, onIndicator, summaries, cellFdr, onClose }: Props) {
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

  return (
    <section className="rg-panel" aria-label={`Diagnóstico de ${region.name}`}>
      <header className="rg-panel-head">
        <div>
          <p className="eyebrow">{region.level === "estado" ? "Estado" : `Região intermediária · ${region.abbreviation}`}</p>
          <h2>{region.name}</h2>
        </div>
        <button className="rg-x" onClick={onClose} aria-label="Fechar diagnóstico">
          ×
        </button>
      </header>

      {sit ? (
        <div className={`rg-situation rg-situation--${sit.kind}`}>
          <p className="rg-situation-text">{sit.text}</p>
          <p className="muted">Evidência de mudança no perigo hidrometeorológico, 2001–2024. Não é risco de desastre.</p>
        </div>
      ) : (
        <p className="muted">Carregando a classificação dos indicadores…</p>
      )}

      <table className="rg-table">
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            <th scope="col">Classificação</th>
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
                    {INDICATOR_INFO[i].label}
                  </button>
                </th>
                <td>{classes[i] ? <Badge cls={classes[i]!} /> : "…"}</td>
                <td className="mono">{st ? slopeText(i, st) : "—"}</td>
                <td className="mono">{st ? formatP(st.pValue) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="rg-h">{info.label}</h3>
      <p className="muted rg-q">
        {info.question} <span className="mono">· {info.product}</span>
      </p>
      <State state={trend} what="série histórica">
        {(r) => {
          const cls = classify(indicator, r.statistics);
          const s = r.statistics;
          return (
            <>
              <TrendChart result={r} unit={info.unit} decimals={info.decimals} significant={isSignificant(cls)} />
              <p className="rg-interp">{interpretation(indicator, r, cls)}</p>
              <dl className="rg-stats mono">
                <dt>Theil-Sen</dt>
                <dd>{slopeText(indicator, s)}</dd>
                <dt>IC 95 %</dt>
                <dd>{ciText(indicator, s)}</dd>
                <dt>τ de Kendall</dt>
                <dd>{s.tau === null ? "—" : signed(s.tau, 2)}</dd>
                <dt>p bruto</dt>
                <dd>{formatP(s.pValue)}</dd>
              </dl>
              <details className="rg-details">
                <summary>Método e notas de qualidade</summary>
                <p className="mono">{s.method}</p>
                <ul>
                  {r.metadata.qualityNotes.map((n) => (
                    <li key={n}>{n}</li>
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

      <h3 className="rg-h">Células dentro da região, após FDR</h3>
      <State state={cellFdr} what="resultados por célula" compact>
        {(d) => {
          const r = fdrReading(d.regions[region.id], d.resolutionDegrees);
          if (!r) return <p className="muted">Nenhuma célula com centro dentro desta região.</p>;
          return (
            <>
              <p className="rg-fdr">{r.text}</p>
              <div className="rg-fdr-bar" aria-hidden>
                <span className="is-raw" style={{ width: `${(r.rawP / r.tested) * 100}%` }} />
                <span className="is-chance" style={{ left: `${(r.expectedByChance / r.tested) * 100}%` }} />
              </div>
              <p className="muted rg-small">
                Barra: fração das células com p &lt; 0,05 sem correção; o traço marca 5 %, o esperado ao acaso. A correção
                Benjamini-Hochberg (q = 0,05) foi aplicada pelo pipeline entre as {d.cellsTested.toLocaleString("pt-BR")} células
                do indicador.
              </p>
            </>
          );
        }}
      </State>

      <h3 className="rg-h">O que estes dados não permitem afirmar</h3>
      <ul className="rg-limits">
        <li>Risco de enchente ou de desastre: faltam exposição, vulnerabilidade, relevo detalhado e drenagem.</li>
        <li>Causa da mudança: 24 anos não separam tendência de longo prazo de variabilidade (El Niño/La Niña).</li>
        <li>Resultado regional sem correção para testes múltiplos: com 24 áreas e 4 indicadores, alguns p &lt; 0,05 surgem por acaso.</li>
        {indicator === "SOIL_SURFACE" && <li>Umidade do solo é saída do modelo GLDAS, não medição.</li>}
      </ul>
    </section>
  );
}
