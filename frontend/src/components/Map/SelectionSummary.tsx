import type {
  TrendResult,
  LayerId,
  LoadState,
  Region,
} from "../../types/geography";
import { evidenceOf, indicators } from "./MapLayers";
import { useLanguage } from "../../i18n/LanguageContext";
const format = (value: number | null | undefined, locale: string) =>
  value == null
    ? "—"
    : value.toLocaleString(locale, { maximumFractionDigits: 3 });
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
  const { language, t } = useLanguage();
  const locale = language === "pt" ? "pt-BR" : "en-US";
  const stats = value?.statistics;
  const evidence = evidenceOf(value);
  const descriptions = {
    significant: t("Evidência significativa"),
    inconclusive: t("Resultado inconclusivo"),
    exploratory: t("Resultado exploratório · revisar qualidade"),
    missing: t("Dados insuficientes / indisponíveis"),
  };
  return (
    <section className="selection-summary" aria-live="polite">
      <div className="eyebrow">{t("03 / EVIDÊNCIAS DA REGIÃO")}</div>
      {region ? (
        <>
          <div className="region-heading">
            <h2>{region.name}</h2>
            <span>{region.abbreviation}</span>
          </div>
          <p className="mono muted">
            ID {region.id} ·{" "}
            {region.id.length === 2
              ? t("Unidade da Federação")
              : t("Região de análise")}
          </p>
          {layer === "neutral" ? (
            <p className="neutral-message">
              {t("Ative tendências históricas para explorar os indicadores.")}
            </p>
          ) : (
            <>
              <p className="metric-label">
                {value
                  ? t(indicators[value.indicator].name)
                  : t("Tendência histórica")}
              </p>
              <div className="metric-value">
                {status === "loading"
                  ? "…"
                  : status === "error" || evidence === "missing"
                    ? "—"
                  : format(stats?.slopePerDecade, locale)}
                <span>
                  {value?.metadata.unit ?? ""}
                  <small> / {t("década")}</small>
                </span>
              </div>
              <p className={`availability evidence-${evidence}`}>
                {status === "loading"
                  ? t("Carregando análise…")
                  : status === "error"
                    ? t("Fonte indisponível")
                    : descriptions[evidence]}
              </p>
              {value && status === "ready" && (
                <>
                  <dl>
                    <dt>{t("Período")}</dt>
                    <dd>
                      {value.period.start}–{value.period.end}
                    </dd>
                    <dt>{t("Valor de p")}</dt>
                    <dd>{format(stats?.pValue, locale)}</dd>
                    <dt>{t("Tau")}</dt>
                    <dd>{format(stats?.tau, locale)}</dd>
                    <dt>{t("IC de 95%")}</dt>
                    <dd>
                      {stats?.confidenceInterval95
                        ? `${format(stats.confidenceInterval95[0], locale)} ${t("a")} ${format(stats.confidenceInterval95[1], locale)} ${value.metadata.unit}/${t("década")}`
                        : t("Indisponível")}
                    </dd>
                    <dt>{t("Direção")}</dt>
                    <dd>
                      {stats?.direction === "increasing"
                        ? t("Crescente")
                        : stats?.direction === "decreasing"
                          ? t("Decrescente")
                          : t("Inconclusiva")}
                    </dd>
                    <dt>{t("Qualidade")}</dt>
                    <dd>
                      {stats?.status === "valid"
                        ? t("Válida")
                        : stats?.status === "exploratory"
                          ? t("Exploratória")
                          : t("Insuficiente")}
                    </dd>
                    <dt>{t("Método")}</dt>
                    <dd>{t(stats?.method ?? "")}</dd>
                    <dt>{t("Fonte")}</dt>
                    <dd>
                      {value.metadata.productId} · v{value.metadata.version}
                    </dd>
                    <dt>{t("DOI")}</dt>
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
                        t("Não se aplica (sintético)")
                      )}
                    </dd>
                  </dl>
                  <div className="quality-notes">
                    {value.metadata.qualityNotes.map((note) => (
                      <p key={note}>{t(note)}</p>
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
          <h2>{t("Explore uma evidência")}</h2>
          <p>
            {t("Selecione uma região para inspecionar a magnitude, a significância e as limitações da tendência.")}
          </p>
        </div>
      )}
    </section>
  );
}
