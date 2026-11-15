import type { CellReading, Snapshot, YearSummary } from "../../types/climate";
import { coord, mm, monthLabel, pct } from "../../lib/format";

interface Props {
  data: Snapshot;
  summary: YearSummary;
  cell: CellReading | null;
}

export default function RegionPanel({ data, summary, cell }: Props) {
  const n = data.years.length;
  const wet = summary.anomalyPct >= 0;
  const rankText =
    summary.rankDry <= n / 2
      ? `${summary.rankDry}º mais seco de ${n}`
      : `${n - summary.rankDry + 1}º mais chuvoso de ${n}`;

  return (
    <aside className="panel">
      <p className="eyebrow">Resumo do recorte · {summary.year}</p>
      <p className={`verdict ${wet ? "is-wet" : "is-dry"}`}>
        {pct(summary.anomalyPct)}
      </p>
      <p className="verdict-sub">
        em relação à média 2001–2024 de{" "}
        <span className="mono">{mm(data.annual.regionalClimatology)}</span>
      </p>

      <dl className="facts">
        <div>
          <dt>Média do total anual (BBOX/terra)</dt>
          <dd className="mono">{mm(summary.total)}</dd>
        </div>
        <div>
          <dt>Posição na série</dt>
          <dd className="mono">{rankText}</dd>
        </div>
        <div>
          <dt>Mês mais chuvoso</dt>
          <dd className="mono">
            {monthLabel(summary.wettestMonth.t)} · {mm(summary.wettestMonth.v)}
          </dd>
        </div>
        <div>
          <dt>Mês mais seco</dt>
          <dd className="mono">
            {monthLabel(summary.driestMonth.t)} · {mm(summary.driestMonth.v)}
          </dd>
        </div>
        <div>
          <dt>Umidade 0–10 cm · média dos meses disponíveis</dt>
          <dd className="mono">
            {summary.soilMean != null
              ? `${summary.soilMean.toFixed(1).replace(".", ",")} kg m⁻² (${summary.soilMonths}/12 meses)`
              : "sem dados neste snapshot"}
          </dd>
        </div>
      </dl>

      <div className={`probe ${cell ? "is-active" : ""}`} aria-live="polite">
        <p className="eyebrow">Sonda · bloco agregado 0,2°</p>
        {cell ? (
          <>
            <p className="mono probe-coord">
              {coord(cell.lat, "N", "S")} {coord(cell.lon, "L", "O")}
              {!cell.land && <span className="tag">fora da máscara GLDAS</span>}
            </p>
            <dl className="probe-grid">
              <dt>{summary.year}</dt>
              <dd className="mono">{mm(cell.total)}</dd>
              <dt>média</dt>
              <dd className="mono">{mm(cell.climatology)}</dd>
              <dt>anomalia</dt>
              <dd
                className={`mono ${cell.anomalyPct >= 0 ? "is-wet" : "is-dry"}`}
              >
                {pct(cell.anomalyPct)}
              </dd>
            </dl>
          </>
        ) : (
          <p className="muted probe-hint">
            Passe o cursor, toque ou use as setas no mapa. Clique ou pressione
            Enter para fixar a leitura.
          </p>
        )}
      </div>
    </aside>
  );
}
