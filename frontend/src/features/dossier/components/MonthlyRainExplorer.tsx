import { useEffect, useMemo, useState } from "react";
import { useMonthlyRainfall } from "../hooks/useMonthlyRainfall";
import { useMonthlyPlayback } from "../hooks/useMonthlyPlayback";
import { monthLabel, monthlyAnomaly } from "../services/monthlyApi";
import { MonthlyRainMap } from "./MonthlyRainMap";
import { MonthlyCellHistory } from "./MonthlyCellHistory";
import { ANOMALY_STOPS, TOTAL_STOPS } from "../lib/color";

const EMPTY_MONTHS:string[]=[];
const number=(v:number|null,unit="mm")=>v===null?"Indisponível":`${v.toLocaleString("pt-BR",{maximumFractionDigits:2})} ${unit}`;
export function MonthlyRainExplorer({compact=false}:{compact?:boolean}={}) {
  const [month,setMonth]=useState("2001-01");
  const [mode,setMode]=useState<"total"|"anomaly">("total");
  const [selected,setSelected]=useState<number|null>(null);
  const [search,setSearch]=useState("");
  const [searchError,setSearchError]=useState("");
  const [retry,setRetry]=useState(0);
  const {manifest,frame,error}=useMonthlyRainfall(month,retry);
  const playback=useMonthlyPlayback(manifest?.months??EMPTY_MONTHS,month,!!frame&&!error,setMonth);
  const {pause}=playback;
  useEffect(()=>{if(error)pause();},[error,pause]);
  const reference=manifest?.climatology[month.slice(5,7)];
  const aggregate=useMemo(()=>{
    if(!frame||!reference)return null;
    let sum=0,ref=0,count=0,valid=0;
    frame.values.forEach((v,i)=>{if(v!==null){valid++;if(reference[i]!==null){sum+=v;ref+=reference[i]!;count++;}}});
    return {value:count?sum/count:null,reference:count?ref/count:null,count,valid};
  },[frame,reference]);
  const cell=manifest&&selected!==null?manifest.cells[selected]:null;
  const selectedValue=selected!==null&&frame?frame.values[selected]:null;
  const baseline=selected!==null&&reference?reference[selected]:null;
  const index=manifest?.months.indexOf(month)??0;
  const chooseMonth=(value:string)=>{if(manifest?.months.includes(value))playback.select(value);};
  const select=(i:number)=>{setSelected(i);setSearchError("");};
  const searchForm=manifest?<form className="monthly-cell-search" onSubmit={e=>{e.preventDefault();const i=manifest.cells.findIndex(c=>c.id===search.trim());if(i<0)setSearchError("ID não encontrado na grade mensal.");else select(i);}}>
          <label htmlFor="monthly-cell-id">Selecionar célula pelo ID nativo</label><div><input id="monthly-cell-id" value={search} onChange={e=>setSearch(e.target.value)} placeholder="imerg-monthly-v07:r…:c…"/>
            <button>Selecionar célula</button></div>{searchError&&<p role="alert">{searchError}</p>}
        </form>:null;
  return <section className={`exhibit monthly-explorer${compact?" is-compact":""}`} aria-label="Exploração mensal da chuva">
    <div className="exhibit-head">{!compact&&<p className="exhibit-tag">Mapa mensal</p>}
      {compact?<h2 className="dossier-col-title">Onde choveu mais ou menos <span aria-hidden="true">•</span> <small>{mode==="total"?"Acumulado":"Anomalia"} {monthLabel(month)}</small></h2>
      :<h2>{mode==="total"?"Chuva acumulada":"Anomalia de chuva"} · <span className="year-mark">{monthLabel(month)}</span></h2>}
      <div className="seg" role="tablist" aria-label="Modo do mapa mensal">
        <button className="seg-btn" role="tab" aria-selected={mode==="total"} onClick={()=>setMode("total")}>Chuva mensal · mm</button>
        <button className="seg-btn" role="tab" aria-selected={mode==="anomaly"} onClick={()=>setMode("anomaly")}>Anomalia · %</button>
      </div>
    </div>
    <div className="temporal-player" role="group" aria-label="Animação temporal mensal">
      <div className="player-main">
        <button className="play-button" onClick={playback.toggle} aria-pressed={playback.playing} disabled={!frame||!!error}>
          {playback.playing?"Ⅱ Pausar":"▶ Reproduzir"}</button>
        <button className="step-button" aria-label="Mês anterior" disabled={!manifest||index<=0} onClick={()=>playback.select(manifest!.months[index-1])}>‹</button>
        <output className="player-year" aria-label="Mês exibido">{monthLabel(month)}</output>
        <button className="step-button" aria-label="Próximo mês" disabled={!manifest||index>=manifest.months.length-1} onClick={()=>playback.select(manifest!.months[index+1])}>›</button>
        <label className="player-speed">Velocidade <select aria-label="Velocidade da animação mensal" value={playback.speed} onChange={e=>playback.setSpeed(Number(e.target.value))}>
          <option value={.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
        <label className="player-loop"><input type="checkbox" checked={playback.loop} onChange={e=>playback.setLoop(e.target.checked)}/> Repetir</label>
        <label className="monthly-date">Ir para o mês <input type="month" aria-label="Escolher mês da chuva" min="2001-01" max="2024-12" value={month}
          disabled={!manifest} onInput={e=>chooseMonth(e.currentTarget.value)} onChange={e=>chooseMonth(e.currentTarget.value)}/></label>
      </div>
      <div className="player-track"><span>jan/2001</span><input type="range" aria-label="Selecionar mês da animação" aria-valuetext={monthLabel(month)}
        min={0} max={287} step={1} value={index} disabled={!manifest} onChange={e=>playback.select(manifest!.months[Number(e.target.value)])}/><span>dez/2024</span></div>
      {!compact&&<p>Um quadro por mês · 288 meses observados · carregamento em blocos anuais com antecipação dos próximos quadros.</p>}
    </div>
    {error?<div className="monthly-error" role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></div>:!manifest?<p role="status">Carregando a grade e as referências mensais…</p>:null}
    {manifest&&<div className="map-layout">
      <div>
        <MonthlyRainMap manifest={manifest} values={error?null:frame?.values??null} month={month} mode={mode} selected={selected} onSelect={select}/>
        <div className="legend monthly-legend" aria-label="Legenda do mapa mensal">
          <div className="legend-bar" style={{background:`linear-gradient(90deg,${(mode==="total"?TOTAL_STOPS:ANOMALY_STOPS).join(",")})`}}/>
          <div className="monthly-legend-labels">{mode==="total"?<><span>0 mm</span><span>≥600 mm/mês</span></>:<><span>≤−50%</span><span>Referência</span><span>≥+50%</span></>}</div>
          <p className="muted">Cinza: valor ou anomalia indisponível. A escala satura nos limites; o painel mostra o valor real.</p>
        </div>
        {compact?<details className="monthly-search-wrap"><summary>Buscar célula pelo ID nativo</summary>{searchForm}</details>:searchForm}
      </div>
      <aside className="monthly-panel" aria-label="Leitura mensal">
        <p className="eyebrow">{monthLabel(month)} · PR / SC / RS</p>
        {!frame||error?<p role="status">Aguardando os valores deste mês.</p>:<>
          <h3>Média mensal do recorte</h3><p className="monthly-big">{number(aggregate?.value??null)}</p>
          <p className="muted">Média simples das {aggregate?.count.toLocaleString("pt-BR")} células com chuva e referência válidas.</p>
          <dl className="monthly-readings"><dt>Referência do mesmo mês</dt><dd>{number(aggregate?.reference??null)}</dd>
            <dt>Anomalia da média</dt><dd>{number(monthlyAnomaly(aggregate?.value??null,aggregate?.reference??null),"%")}</dd>
            <dt>Cobertura do quadro</dt><dd>{aggregate?.valid}/{manifest.cells.length} células</dd></dl>
        </>}
        <hr/><h3>Célula selecionada</h3>
        {cell?<><p className="mono monthly-id">{cell.id}</p><p className="muted">Centro: {manifest.grid.lat[Math.floor(cell.index/manifest.grid.lon.length)].toFixed(2)}°, {manifest.grid.lon[cell.index%manifest.grid.lon.length].toFixed(2)}° · grade 0,1°.</p>
          {!frame||error?<p role="status">Atualizando valores da célula…</p>:<dl className="monthly-readings">
            <dt>Chuva no mês</dt><dd>{selectedValue===null?"Sem dados":number(selectedValue)}</dd><dt>Referência mensal</dt><dd>{number(baseline)}</dd>
            <dt>Anomalia</dt><dd>{number(monthlyAnomaly(selectedValue,baseline),"%")}</dd>
            <dt>Anos da referência</dt><dd>{manifest.referenceCounts[month.slice(5,7)][selected!]}/24</dd></dl>}
          <MonthlyCellHistory manifest={manifest} id={cell.id} month={month} onSelectMonth={playback.select}/>
        </>:<p>Clique no mapa, use as setas do teclado ou procure um ID. A mesma célula permanece selecionada ao mudar o mês.</p>}
        <details className="monthly-method"><summary>Fonte e referência mensal</summary>
          <p>{manifest.metadata.productId} · {manifest.metadata.version} · unidade: mm/mês.</p>
          <p>Janeiro é comparado aos janeiros de 2001–2024, fevereiro aos fevereiros, e assim por diante. Exigimos 24 anos válidos para cada referência.</p>
          {manifest.metadata.qualityNotes.map(note=><p key={note}>{note}</p>)}
          <a href={`https://doi.org/${manifest.metadata.sourceDOI}`} target="_blank" rel="noreferrer">Fonte NASA · DOI</a>
        </details>
      </aside>
    </div>}
    {!compact&&<p className="monthly-science-note">Anomalia mensal descreve diferença em relação ao histórico. Não é teste de tendência, previsão de chuva ou avaliação de segurança de uma rota.</p>}
  </section>;
}
