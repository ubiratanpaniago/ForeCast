import type {
  TrendResult,
  LayerId,
  LoadState,
  Region,
} from "../../types/geography";
import { evidenceOf, indicators } from "./MapLayers";
const format = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export function SelectionSummary({
  region,
  value,
  layer,
  status,
}: {
  region?: Region;
  value?: TrendResult;
  layer: LayerId;
  status: LoadState;
}) {
  const stats = value?.statistics;
  const evidence = evidenceOf(value);
  const descriptions = {
    significant: "Evidência significativa",
    inconclusive: "Resultado inconclusivo",
    exploratory: "Resultado exploratório · revisar qualidade",
    missing: "Dados insuficientes / indisponíveis",
  };
  return (
    <section className="selection-summary" aria-live="polite">
      <div className="eyebrow">03 / EVIDÊNCIAS DA REGIÃO</div>
      {region ? (
        <>
          <div className="region-heading">
            <h2>{region.name}</h2>
            <span>{region.abbreviation}</span>
          </div>
          <p className="mono muted">
            ID {region.id} ·{" "}
            {region.id.length === 2
              ? "Unidade da Federação"
              : "Região de análise"}
          </p>
          {layer === "neutral" ? (
            <p className="neutral-message">
              Ative tendências históricas para explorar os indicadores.
            </p>
          ) : (
            <>
              <p className="metric-label">
                {value
                  ? indicators[value.indicator].name
                  : "Tendência histórica"}
              </p>
              <div className="metric-value">
                {status === "loading"
                  ? "…"
                  : status === "error" || evidence === "missing"
                    ? "—"
                    : format(stats?.slopePerDecade)}
                <span>
                  {value?.metadata.unit ?? ""}
                  <small> / década</small>
                </span>
              </div>
              <p className={`availability evidence-${evidence}`}>
                {status === "loading"
                  ? "Carregando análise…"
                  : status === "error"
                    ? "Fonte indisponível"
                    : descriptions[evidence]}
              </p>
              {value && status === "ready" && (
                <>
                  <dl>
                    <dt>Período</dt>
                    <dd>
                      {value.period.start}–{value.period.end}
                    </dd>
                    <dt>Valor de p</dt>
                    <dd>{format(stats?.pValue)}</dd>
                    <dt>Tau</dt>
                    <dd>{format(stats?.tau)}</dd>
                    <dt>IC de 95%</dt>
                    <dd>
                      {stats?.confidenceInterval95
                        ? `${format(stats.confidenceInterval95[0])} a ${format(stats.confidenceInterval95[1])} ${value.metadata.unit}/década`
                        : "Indisponível"}
                    </dd>
                    <dt>Direção</dt>
                    <dd>
                      {stats?.direction === "increasing"
                        ? "Crescente"
                        : stats?.direction === "decreasing"
                          ? "Decrescente"
                          : "Inconclusiva"}
                    </dd>
                    <dt>Qualidade</dt>
                    <dd>
                      {stats?.status === "valid"
                        ? "Válida"
                        : stats?.status === "exploratory"
                          ? "Exploratória"
                          : "Insuficiente"}
                    </dd>
                    <dt>Método</dt>
                    <dd>{stats?.method}</dd>
                    <dt>Fonte</dt>
                    <dd>
                      {value.metadata.productId} · v{value.metadata.version}
                    </dd>
                    <dt>DOI</dt>
                    <dd>
                      {value.metadata.sourceDOI.startsWith("10.") ? (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={`https://doi.org/${encodeURIComponent(value.metadata.sourceDOI)}`}
                        >
                          {value.metadata.sourceDOI}
                        </a>
                      ) : (
                        "Não se aplica (sintético)"
                      )}
                    </dd>
                  </dl>
                  <div className="quality-notes">
                    {value.metadata.qualityNotes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <div className="empty-selection">
          <span aria-hidden="true">⌖</span>
          <h2>Explore uma evidência</h2>
          <p>
            Selecione uma região para inspecionar a magnitude, a significância e
            as limitações da tendência.
          </p>
        </div>
      )}
    </section>
  );
}
