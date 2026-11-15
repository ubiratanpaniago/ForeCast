import { useEffect, useMemo, useRef, useState } from "react";
import type { RegionsGeoJSON } from "../../types/geography";
import { getRegionGeometry } from "../../services/regionApi";
import { MonthlyRainMap } from "../dossier/components/MonthlyRainMap";
import { useMonthlyPlayback } from "../dossier/hooks/useMonthlyPlayback";
import { useMonthlyRainfall } from "../dossier/hooks/useMonthlyRainfall";
import { monthlyAnomaly } from "../dossier/services/monthlyApi";
import { HomeHistory } from "./HomeHistory";
import { fullMonth, placeName, rainDescription, rainSummary } from "./homeData";
import "./simple-home.css";

const EMPTY_MONTHS: string[] = [];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const mm = (value: number | null) => value === null ? "Sem dados" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mm`;

function RainBar({ label, value, maximum, kind }: {
  label: string; value: number | null; maximum: number; kind: "recorded" | "average";
}) {
  return <div className="home-rain-row">
    <div className="home-rain-label"><span>{label}</span><strong>{mm(value)}</strong></div>
    <div className="home-rain-track" aria-hidden="true">
      {value !== null && <span className={`home-rain-fill ${kind}`} style={{ width: `${value / maximum * 100}%` }} />}
    </div>
  </div>;
}

export default function SimpleHome() {
  const [month, setMonth] = useState("2024-12");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [regions, setRegions] = useState<RegionsGeoJSON | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const supportButton = useRef<HTMLButtonElement>(null);
  const { manifest, frame, error } = useMonthlyRainfall(month, retry);
  const ready = !!frame && !error;
  const playback = useMonthlyPlayback(manifest?.months ?? EMPTY_MONTHS, month, ready, setMonth);
  const { pause } = playback;
  useEffect(() => { if (error) pause(); }, [error, pause]);
  useEffect(() => {
    let active = true;
    void getRegionGeometry().then(data => { if (active) setRegions(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (supportOpen && !dialog.current?.open) dialog.current?.showModal();
  }, [supportOpen]);
  const selected = useMemo(() => {
    if (!manifest || !selectedId) return null;
    const index = manifest.cells.findIndex(c => c.id === selectedId);
    return index >= 0 ? index : null;
  }, [manifest, selectedId]);
  const reference = manifest?.climatology[month.slice(5, 7)];
  const summary = useMemo(() => {
    if (!frame || !reference) return { value: null, reference: null, count: 0 };
    if (selected !== null) return { value: frame.values[selected], reference: reference[selected], count: 1 };
    return rainSummary(frame.values, reference);
  }, [frame, reference, selected]);
  const location = useMemo(() => {
    if (!manifest || selected === null) return "Sul do Brasil";
    const index = manifest.cells[selected].index;
    return placeName(regions, manifest.grid.lon[index % manifest.grid.lon.length], manifest.grid.lat[Math.floor(index / manifest.grid.lon.length)]);
  }, [manifest, selected, regions]);
  const anomaly = ready ? monthlyAnomaly(summary.value, summary.reference) : null;
  const index = manifest?.months.indexOf(month) ?? 0;
  const maximum = Math.max(summary.value ?? 0, summary.reference ?? 0, 1);
  const choose = (value: string) => { if (manifest?.months.includes(value)) playback.select(value); };
  const changePoint = (i: number) => { if (manifest) { pause(); setSelectedId(manifest.cells[i].id); } };

  return <div className="simple-home">
    <a className="home-skip" href="#home-main">Ir para o conteúdo</a>
    <header className="home-header">
      <a className="home-brand" href="/" aria-label="ForeCast, página principal"><span>ForeCast<span className="home-brand-dot">.</span></span><small>Chuva, história e cuidado.</small></a>
      <div className="home-header-copy"><h1>As chuvas na sua região</h1><p>Veja o mapa. Escolha um lugar. Entenda as mudanças.</p></div>
      <button ref={supportButton} className="home-support" onClick={() => { pause(); setSupportOpen(true); }} aria-haspopup="dialog">
        <span className="home-support-icon" aria-hidden="true">＋</span><span>Apoio<small>Informações e orientação</small></span><span aria-hidden="true">↗</span>
      </button>
    </header>
    <main id="home-main" className="home-dashboard" tabIndex={-1}>
      <section className="home-map-column" aria-labelledby="home-map-title">
        <div className="home-map-heading"><h2 id="home-map-title">Onde choveu mais ou menos</h2>
          <p>Clique em um lugar para ver os dados ao lado.</p></div>
        {error ? <div className="home-data-message" role="alert"><h3>Não conseguimos carregar as chuvas.</h3><p>Tente novamente para ver o mapa.</p><button onClick={() => setRetry(v => v + 1)}>Tentar novamente</button></div>
          : !manifest ? <div className="home-data-message" role="status">Carregando o mapa de chuvas…</div>
          : <MonthlyRainMap manifest={manifest} values={ready ? frame!.values : null} month={month} mode="anomaly" selected={selected} onSelect={changePoint} />}
        <div className="home-map-key" aria-label="Legenda das cores">
          <span><i className="home-dry-swatch" /> Menos chuva</span><span><i className="home-normal-swatch" /> Perto da média</span><span><i className="home-wet-swatch" /> Mais chuva</span>
        </div>
        <p className="home-map-key-note">Comparação com o mesmo mês de outros anos. Cinza: sem dados para mostrar.</p>
        <section className="home-time" aria-label="Escolher mês e reproduzir as chuvas">
          <div className="home-time-top"><span className="home-step">DADOS HISTÓRICOS</span><output aria-label="Mês do mapa">{fullMonth(month)}</output></div>
          <div className="home-date-selects">
            <label>Mês<select aria-label="Mês da chuva" value={month.slice(5, 7)} disabled={!manifest}
              onChange={e => choose(`${month.slice(0, 4)}-${e.target.value}`)}>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}</select></label>
            <label>Ano<select aria-label="Ano da chuva" value={month.slice(0, 4)} disabled={!manifest}
              onChange={e => choose(`${e.target.value}-${month.slice(5, 7)}`)}>{Array.from({ length: 24 }, (_, i) => <option key={2001 + i}>{2001 + i}</option>)}</select></label>
          </div>
          <div className="home-play-controls">
            <button disabled={!manifest || index <= 0} onClick={() => playback.select(manifest!.months[index - 1])} aria-label="Mês anterior"><span aria-hidden="true">←</span> Anterior</button>
            <button className="home-play" disabled={!ready} onClick={playback.toggle} aria-pressed={playback.playing}><span aria-hidden="true">{playback.playing ? "Ⅱ" : "▶"}</span> {playback.playing ? "Pausar" : "Reproduzir"}</button>
            <button disabled={!manifest || index >= manifest.months.length - 1} onClick={() => playback.select(manifest!.months[index + 1])} aria-label="Próximo mês">Próximo <span aria-hidden="true">→</span></button>
          </div>
          <input className="home-time-range" type="range" aria-label="Percorrer os meses do histórico" min={0} max={287} value={index}
            aria-valuetext={fullMonth(month)} disabled={!manifest} onChange={e => playback.select(manifest!.months[Number(e.target.value)])}/>
          <div className="home-time-endpoints"><span>2001</span><span>2024</span></div>
          <p>Este mapa mostra o passado. Não é a chuva de hoje nem uma previsão.</p>
        </section>
      </section>
      <div className="home-reading-column">
        <section className="home-summary" aria-labelledby="home-summary-title">
          <div className="home-section-heading"><h2 id="home-summary-title">Chuva na região escolhida</h2></div>
          <div className="home-place"><span className="home-place-dot" aria-hidden="true"/><strong>{location}</strong>
            {selected !== null && <button onClick={() => { pause(); setSelectedId(null); }}>Ver todo o Sul</button>}</div>
          <p className="home-place-note">{selected === null ? "Média das áreas mostradas no mapa." : "Dados do ponto aproximado que você escolheu."}</p>
          <p className={`home-comparison ${anomaly !== null && anomaly < 0 ? "drier" : "wetter"}`} aria-live="polite">
            {!ready ? "Aguardando os dados do mês…" : rainDescription(anomaly)}</p>
          <div className="home-bars">
            <RainBar label="No mês escolhido" value={ready ? summary.value : null} maximum={maximum} kind="recorded"/>
            <RainBar label="Média histórica desse mês" value={ready ? summary.reference : null} maximum={maximum} kind="average"/>
          </div>
          <p className="home-reference-explanation">Referência: o mesmo mês, de 2001 a 2024.</p>
          <div className="home-forecast-note"><span className="home-unavailable-dot" aria-hidden="true"/><span>Previsão de chuva: <strong>ainda não disponível</strong></span></div>
        </section>
        <HomeHistory manifest={manifest} cellId={selected !== null ? selectedId : null} month={month}/>
        <a className="home-understand" href="/entenda"><span><strong>Entenda o que está acontecendo</strong><small>Veja a evolução das chuvas com mais detalhes.</small></span><span aria-hidden="true">→</span></a>
      </div>
    </main>
    <footer className="home-footer"><span>ForeCast · Paraná, Santa Catarina e Rio Grande do Sul</span><span>Dados NASA · Informações históricas, sem avaliação de rota segura.</span></footer>
    <dialog ref={dialog} className="home-support-dialog" aria-labelledby="home-support-title" aria-describedby="home-support-description"
      onClose={() => { setSupportOpen(false); supportButton.current?.focus(); }}>
      <span className="home-step">APOIO</span><h2 id="home-support-title">Estamos preparando este espaço.</h2>
      <p id="home-support-description">A tela de apoio será desenvolvida em uma próxima etapa. Ela vai reunir informações para ajudar você a se orientar.</p>
      <p>Por enquanto, o ForeCast mostra o histórico das chuvas. Ainda não oferece alertas, abrigos confirmados ou rotas de emergência.</p>
      <p>Em uma emergência, siga as orientações dos órgãos locais responsáveis.</p>
      <button onClick={() => dialog.current?.close()}>Voltar para o mapa</button>
    </dialog>
  </div>;
}
