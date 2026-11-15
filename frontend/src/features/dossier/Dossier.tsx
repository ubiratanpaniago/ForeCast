import { useEffect, useMemo, useState } from "react";
import { TopNavigation } from "../../components/TopNavigation";
import { EXAMPLE_CELL_ID } from "../simple-home/homeData";
import { useHomeHistory } from "../simple-home/useHomeHistory";
import { MonthlyRainMap } from "./components/MonthlyRainMap";
import { useMonthlyRainfall } from "./hooks/useMonthlyRainfall";
import { useMonthlyPlayback } from "./hooks/useMonthlyPlayback";
import { monthLabel, monthlyAnomaly } from "./services/monthlyApi";
import "./styles/dossier.css";

const EMPTY_MONTHS: string[] = [];
const YEARS = Array.from({ length: 24 }, (_, i) => 2001 + i);
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const format = (value: number | null, unit = "mm") => value === null ? "Sem dados" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ${unit}`;
const percent = (value: number | null) => value === null ? "Indisponível" : `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const completeTotal = (values: Array<number | null>) => values.length === 12 && values.every(v => v !== null) ? values.reduce<number>((sum, v) => sum + v!, 0) : null;

export default function Dossier() {
  const [month, setMonth] = useState("2001-01");
  const [cellId, setCellId] = useState(EXAMPLE_CELL_ID);
  const [mode, setMode] = useState<"total" | "anomaly">("anomaly");
  const [year, setYear] = useState(2024);
  const [comparison, setComparison] = useState(2001);
  const [retry, setRetry] = useState(0);
  const { manifest, frame, error } = useMonthlyRainfall(month, retry);
  const playback = useMonthlyPlayback(manifest?.months ?? EMPTY_MONTHS, month, !!frame && !error, setMonth);
  const { pause } = playback;
  useEffect(() => { if (error) pause(); }, [error, pause]);
  const selectedIndex = manifest?.cells.findIndex(c => c.id === cellId) ?? -1;
  const selected = selectedIndex >= 0 ? selectedIndex : null;
  const cell = manifest && selected !== null ? manifest.cells[selected] : null;
  const lat = manifest && cell ? manifest.grid.lat[Math.floor(cell.index / manifest.grid.lon.length)] : null;
  const lon = manifest && cell ? manifest.grid.lon[cell.index % manifest.grid.lon.length] : null;
  const coordinates = lat !== null && lon !== null ? `${Math.abs(lat).toFixed(2).replace(".", ",")}° S · ${Math.abs(lon).toFixed(2).replace(".", ",")}° O` : "Localizando célula…";
  const { points, error: historyError, retry: retryHistory } = useHomeHistory(selected !== null ? manifest : null, cellId);
  const annual = useMemo(() => YEARS.map(y => {
    const series = points?.filter(p => p.t.startsWith(String(y))) ?? [];
    return { year: y, total: completeTotal(series.map(p => p.value)), reference: completeTotal(series.map(p => p.reference)), values: series.map(p => p.value) };
  }), [points]);
  const current = annual.find(a => a.year === year)!;
  const previous = annual.find(a => a.year === comparison)!;
  const difference = current.total !== null && previous.total !== null ? current.total - previous.total : null;
  const chartMax = Math.max(1, ...current.values.map(v => v ?? 0), ...previous.values.map(v => v ?? 0));
  const validYears = annual.filter(a => a.total !== null);
  const driest = validYears.reduce<typeof current | null>((a, b) => !a || b.total! < a.total! ? b : a, null);
  const wettest = validYears.reduce<typeof current | null>((a, b) => !a || b.total! > a.total! ? b : a, null);
  const value = frame && selected !== null && !error ? frame.values[selected] : null;
  const reference = manifest && selected !== null ? manifest.climatology[month.slice(5, 7)][selected] : null;
  const monthIndex = manifest?.months.indexOf(month) ?? 0;
  const chooseMonth = (t: string) => { if (manifest?.months.includes(t)) playback.select(t); };

  return <div className="dossier-board">
    <TopNavigation page="dossier" title="Dossiê exploratório" subtitle="Dados via API · Chuva e anomalias por célula" />
    <header className="dossier-intro">
      <span className="dossier-study">GPM IMERG V07 · 0,1° · 2001–2024</span>
      <h1>Vinte e quatro anos de chuva, examinados célula a célula.</h1>
      <p><strong>Célula selecionada: {coordinates}.</strong> {driest && wettest ? `Menor total anual: ${driest.year} (${format(driest.total)}). Maior: ${wettest.year} (${format(wettest.total)}).` : "Escolha um ponto no mapa para conhecer sua história de chuva."}</p>
    </header>
    <main className="dossier-workspace">
      <section className="dossier-monthly" aria-labelledby="dossier-map-title">
        <div className="dossier-map-heading"><h2 id="dossier-map-title">Onde choveu mais ou menos · {monthLabel(month)}</h2>
          <div className="dossier-modes" role="group" aria-label="Exibição do mapa">
            <button aria-pressed={mode === "anomaly"} onClick={() => setMode("anomaly")}>Mais ou menos chuva</button>
            <button aria-pressed={mode === "total"} onClick={() => setMode("total")}>Total em mm</button>
          </div>
        </div>
        <div className="dossier-player" role="group" aria-label="Animação mensal">
          <button className="dossier-play" onClick={playback.toggle} disabled={!frame || !!error} aria-pressed={playback.playing}>{playback.playing ? "Ⅱ Pausar" : "▶ Reproduzir"}</button>
          <button aria-label="Mês anterior" disabled={!manifest || monthIndex <= 0} onClick={() => chooseMonth(manifest!.months[monthIndex - 1])}>‹</button>
          <output>{monthLabel(month)}</output>
          <button aria-label="Próximo mês" disabled={!manifest || monthIndex >= 287} onClick={() => chooseMonth(manifest!.months[monthIndex + 1])}>›</button>
          <label>Velocidade <select value={playback.speed} onChange={e => playback.setSpeed(Number(e.target.value))}><option value={.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
          <input type="month" aria-label="Ir para o mês" min="2001-01" max="2024-12" value={month} disabled={!manifest} onChange={e => chooseMonth(e.target.value)} />
        </div>
        <div className="dossier-slider"><span>jan/2001</span><input type="range" aria-label="Mês do mapa" aria-valuetext={monthLabel(month)} min={0} max={287} value={monthIndex} disabled={!manifest} onChange={e => chooseMonth(manifest!.months[Number(e.target.value)])} /><span>dez/2024</span></div>
        <div className="dossier-map-reading">
          <div className="dossier-map-box">{manifest ? <MonthlyRainMap manifest={manifest} values={error ? null : frame?.values ?? null} month={month} mode={mode} selected={selected} onSelect={i => setCellId(manifest.cells[i].id)} /> : <p role="status">Carregando mapa…</p>}</div>
          <aside className="dossier-reading" aria-label="Dados da célula">
            <h3>Chuva neste ponto</h3><p>{monthLabel(month)}</p><strong className="dossier-mm">{format(value)}</strong>
            <dl><dt>Média deste mês</dt><dd>{format(reference)}</dd><dt>Diferença da média</dt><dd>{percent(monthlyAnomaly(value, reference))}</dd><dt>Referência disponível</dt><dd>{manifest && selected !== null ? `${manifest.referenceCounts[month.slice(5, 7)][selected]}/24 anos` : "—"}</dd></dl>
            <p className="dossier-coordinate">{coordinates}<br />Célula de 0,1°</p>
            <p>Clique no mapa para mudar o local. Toda a análise acompanha a célula.</p>
            {cellId !== EXAMPLE_CELL_ID && <button onClick={() => setCellId(EXAMPLE_CELL_ID)}>Voltar ao exemplo</button>}
            {manifest && selected === null && <p role="alert">Célula indisponível nesta grade. Escolha outra no mapa.</p>}
          </aside>
        </div>
        <div className="dossier-map-legend">{mode === "anomaly" ? <><span><i className="dry" />Menos chuva</span><span><i className="normal" />Perto da média</span><span><i className="wet" />Mais chuva</span></> : <><span>0 mm</span><i className="rain-scale" /><span>≥600 mm/mês</span></>}</div>
        <p className="dossier-map-note">{mode === "anomaly" ? "Janeiro é comparado aos janeiros de 2001–2024, e assim por diante." : "Chuva acumulada em cada mês. A escala satura em 600 mm."} Cinza: sem dados.</p>
        {error && <p className="dossier-error" role="alert">{error} <button onClick={() => setRetry(v => v + 1)}>Tentar novamente</button></p>}
      </section>
      <section className="dossier-comparison" aria-labelledby="dossier-compare-title">
        <h2 id="dossier-compare-title">Dois anos, a mesma referência</h2><p className="dossier-comparison-note">Totais anuais da célula · referência 2001–2024</p>
        <div className="dossier-years" role="group" aria-label="Escolher ano em análise">{annual.map(a => {
          const anomaly = monthlyAnomaly(a.total, a.reference);
          return <button key={a.year} onClick={() => setYear(a.year)} aria-pressed={year === a.year} aria-label={`${a.year}: ${format(a.total)}, diferença da média ${percent(anomaly)}`}><span className="dossier-year-track"><i style={{ height: `${anomaly === null ? 0 : Math.min(Math.abs(anomaly), 60) / 60 * 48}%`, top: anomaly !== null && anomaly >= 0 ? "auto" : "50%", bottom: anomaly !== null && anomaly >= 0 ? "50%" : "auto", background: anomaly !== null && anomaly >= 0 ? "var(--wet)" : "var(--dry)" }} /></span><small>{String(a.year).slice(2)}</small></button>;
        })}</div>
        <div className="dossier-year-filters"><label>Ano em análise<select value={year} onChange={e => setYear(Number(e.target.value))}>{YEARS.map(y => <option key={y}>{y}</option>)}</select></label><label>Ano de comparação<select value={comparison} onChange={e => setComparison(Number(e.target.value))}>{YEARS.map(y => <option key={y}>{y}</option>)}</select></label></div>
        <div className="dossier-totals">
          <div><span>{year} · total anual</span><strong>{format(current.total)}</strong><small>Diferença da média: {percent(monthlyAnomaly(current.total, current.reference))}</small></div>
          <div><span>{comparison} · total anual</span><strong>{format(previous.total)}</strong><small>Diferença da média: {percent(monthlyAnomaly(previous.total, previous.reference))}</small></div>
          <div><span>{year} menos {comparison}</span><strong>{difference !== null && difference > 0 ? "+" : ""}{format(difference)}</strong><small>{percent(monthlyAnomaly(current.total, previous.total))} em relação a {comparison}</small></div>
        </div>
        <div className="dossier-chart-key"><span><i />{year}</span><span><i />{comparison}</span><span>Chuva mensal · mm · mesma escala</span></div>
        <div className="dossier-bars" role="img" aria-label={`Comparação da precipitação mensal da célula em ${year} e ${comparison}. Escala de zero a ${Math.ceil(chartMax)} milímetros. Valores disponíveis em cada barra.`}>
          <span className="dossier-chart-max">{Math.ceil(chartMax)} mm</span>
          {MONTHS.map((label, i) => <div className="dossier-month-bars" key={label}><div className="dossier-bar-pair">{[current, previous].map((a, j) => { const v = a.values[i] ?? null; return <span key={j} className={`dossier-bar dossier-bar-${j}`} style={{ height: `${v === null ? 0 : v / chartMax * 100}%` }} tabIndex={0} aria-label={`${label}/${a.year}: ${format(v)}`}><span className="dossier-bar-tip">{label}/{a.year}: {format(v)}</span></span>; })}</div><small>{label}</small></div>)}
        </div>
        {historyError ? <p className="dossier-error" role="alert">{historyError} <button onClick={retryHistory}>Tentar novamente</button></p> : !points ? <p role="status">Carregando a série da célula…</p> : <p className="dossier-completeness">Total anual apenas com os 12 meses válidos. Valores ausentes não são tratados como zero.</p>}
      </section>
    </main>
    <footer className="dossier-board-footer"><span>ForeCast · {coordinates} · IMERG V07</span><span>Dados históricos · Anomalia não é previsão ou alerta de inundação.</span></footer>
  </div>;
}
