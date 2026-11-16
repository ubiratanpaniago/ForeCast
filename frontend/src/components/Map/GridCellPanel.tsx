import type { GridCell, GridDefinition, CellDetail } from "../../types/grid";
import type { LoadState, LayerId } from "../../types/geography";
import { SelectionSummary } from "./SelectionSummary";
import { useLanguage } from "../../i18n/LanguageContext";
export function GridCellPanel({
  cell,
  grid,
  detail,
  status,
  error,
  layer,
}: {
  cell?: GridCell;
  grid?: GridDefinition;
  detail: CellDetail | null;
  status: LoadState;
  error: string;
  layer: LayerId;
}) {
  const { language, t } = useLanguage();
  const locale = language === "pt" ? "pt-BR" : "en-US";
  const coordinate = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 5 });
  return (
    <section className="cell-panel">
      <div className="eyebrow">{t("03 / CÉLULA NATIVA")}</div>
      {!cell ? (
        <p>
          {t("Selecione uma célula real no mapa quando a grade estiver disponível.")}
        </p>
      ) : (
        <>
          <h2>{cell.id}</h2>
          {cell.annualValue !== undefined && <p>
            {t("Último ano do período:")} {cell.annualValue === null ? t("Sem dados completos") : `${cell.annualValue.toLocaleString(locale, { maximumFractionDigits: 2 })} ${detail?.metadata.unit ?? ""}`}
          </p>}
          <dl>
            <dt>{t("Grade")}</dt>
            <dd>{grid?.name}</dd>
            <dt>{t("Índice nativo")}</dt>
            <dd>
              {t("Linha {row} / coluna {column}").replace("{row}", cell.row.toLocaleString(locale)).replace("{column}", cell.column.toLocaleString(locale))}
            </dd>
            <dt>{t("Centro WGS84")}</dt>
            <dd>
              {cell.center[1].toLocaleString(locale, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}°, {cell.center[0].toLocaleString(locale, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}° ({t("lat")}, {t("lon")})
            </dd>
            <dt>{t("Resolução")}</dt>
            <dd>
              {grid?.resolutionDegrees}° × {grid?.resolutionDegrees}°
            </dd>
            <dt>{t("Interseção")}</dt>
            <dd>
              {cell.fractionInside === null
                ? t("Não informada")
                : `${(cell.fractionInside * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% ${t("nos estados")}`}
            </dd>
          </dl>
          <details>
            <summary>{t("Limites geográficos")}</summary>
            <p className="mono">
              W {coordinate(cell.bounds[0])} / S {coordinate(cell.bounds[1])}
              <br />E {coordinate(cell.bounds[2])} / N {coordinate(cell.bounds[3])}
            </p>
          </details>
          {status === "loading" ? (
            <p role="status">{t("Consultando série da célula…")}</p>
          ) : error ? (
            <p role="alert">{t(error)}</p>
          ) : (
            detail && (
              <>
                <p className="source-note">
                  {detail.metadata.productId} · v{detail.metadata.version}
                  <br />
                  {t("Unidade anual:")} {detail.metadata.unit}
                  <br />
                  {t("Período:")} {detail.period.start}–{detail.period.end}
                </p>
                {detail.statistics ? (
                  <SelectionSummary
                    region={{
                      id: cell.id,
                      name: "Tendência da célula",
                      abbreviation: "",
                    }}
                    value={{
                      ...detail,
                      regionId: cell.id,
                      statistics: detail.statistics,
                    }}
                    layer={layer}
                    status="ready"
                  />
                ) : (
                  <p>
                    {t("Série disponível. Análise estatística ainda não fornecida; nenhum teste foi calculado no navegador.")}
                  </p>
                )}
                <details className="annual-series" open>
                  <summary>
                    {t("Série anual · {available}/{total} anos com dados").replace("{available}", detail.series.filter((p) => p.value !== null).length.toLocaleString(locale)).replace("{total}", detail.series.length.toLocaleString(locale))}
                  </summary>
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Ano")}</th>
                        <th>{detail.metadata.unit}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.series.map((p) => (
                        <tr key={p.year}>
                          <td>{p.year}</td>
                          <td>
                            {p.value === null
                              ? t("Sem dados")
                              : p.value.toLocaleString(locale, {
                                  maximumFractionDigits: 3,
                                })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                <div className="quality-notes">
                    {detail.metadata.qualityNotes.map((n) => (
                    <p key={n}>{t(n)}</p>
                  ))}
                </div>
              </>
            )
          )}
        </>
      )}
    </section>
  );
}
