import type { GridCell, GridDefinition, CellDetail } from "../../types/grid";
import type { LoadState, LayerId } from "../../types/geography";
import { SelectionSummary } from "./SelectionSummary";
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
  return (
    <section className="cell-panel">
      <div className="eyebrow">03 / CÉLULA NATIVA</div>
      {!cell ? (
        <p>
          Selecione uma célula real no mapa quando a grade estiver disponível.
        </p>
      ) : (
        <>
          <h2>{cell.id}</h2>
          {cell.annualValue !== undefined && <p>
            Último ano do período: {cell.annualValue === null ? "Sem dados completos" : `${cell.annualValue.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${detail?.metadata.unit ?? ""}`}
          </p>}
          <dl>
            <dt>Grade</dt>
            <dd>{grid?.name}</dd>
            <dt>Índice nativo</dt>
            <dd>
              Linha {cell.row} / coluna {cell.column}
            </dd>
            <dt>Centro WGS84</dt>
            <dd>
              {cell.center[1].toFixed(5)}°, {cell.center[0].toFixed(5)}° (lat,
              lon)
            </dd>
            <dt>Resolução</dt>
            <dd>
              {grid?.resolutionDegrees}° × {grid?.resolutionDegrees}°
            </dd>
            <dt>Interseção</dt>
            <dd>
              {cell.fractionInside === null
                ? "Não informada"
                : `${(cell.fractionInside * 100).toFixed(1)}% nos estados`}
            </dd>
          </dl>
          <details>
            <summary>Limites geográficos</summary>
            <p className="mono">
              W {cell.bounds[0]} / S {cell.bounds[1]}
              <br />E {cell.bounds[2]} / N {cell.bounds[3]}
            </p>
          </details>
          {status === "loading" ? (
            <p role="status">Consultando série da célula…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : (
            detail && (
              <>
                <p className="source-note">
                  {detail.metadata.productId} · v{detail.metadata.version}
                  <br />
                  Unidade anual: {detail.metadata.unit}
                  <br />
                  Período: {detail.period.start}–{detail.period.end}
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
                    Série disponível. Análise estatística ainda não fornecida;
                    nenhum teste foi calculado no navegador.
                  </p>
                )}
                <details className="annual-series" open>
                  <summary>
                    Série anual ·{" "}
                    {detail.series.filter((p) => p.value !== null).length}/
                    {detail.series.length} anos com dados
                  </summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Ano</th>
                        <th>{detail.metadata.unit}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.series.map((p) => (
                        <tr key={p.year}>
                          <td>{p.year}</td>
                          <td>
                            {p.value === null
                              ? "Sem dados"
                              : p.value.toLocaleString("pt-BR", {
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
                    <p key={n}>{n}</p>
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
