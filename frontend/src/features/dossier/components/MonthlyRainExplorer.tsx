import { useEffect, useMemo, useState } from "react";
import { useMonthlyRainfall } from "../hooks/useMonthlyRainfall";
import { useMonthlyPlayback } from "../hooks/useMonthlyPlayback";
import { monthLabel, monthlyAnomaly } from "../services/monthlyApi";
import { MonthlyRainMap } from "./MonthlyRainMap";
import { MonthlyCellHistory } from "./MonthlyCellHistory";
import { ANOMALY_STOPS, TOTAL_STOPS } from "../lib/color";
import { useLanguage } from "../../../i18n/LanguageContext";

const EMPTY_MONTHS:string[]=[];
const number=(v:number|null,language:"pt"|"en",unit="mm")=>v===null?(language==="pt"?"Indisponível":"Unavailable"):`${v.toLocaleString(language==="pt"?"pt-BR":"en-US",{maximumFractionDigits:2})} ${unit}`;
export function MonthlyRainExplorer({compact=false}:{compact?:boolean}={}) {
  const {language,t}=useLanguage();
  const locale=language==="pt"?"pt-BR":"en-US";
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
  const exampleIndex=useMemo(()=>{
    if(!manifest)return null;
    const targetLat=-28.05,targetLon=-52.45;
    let nearest=0,distance=Number.POSITIVE_INFINITY;
    manifest.cells.forEach((candidate,i)=>{
      const row=Math.floor(candidate.index/manifest.grid.lon.length),column=candidate.index%manifest.grid.lon.length;
      const lat=manifest.grid.lat[row],lon=manifest.grid.lon[column];
      const d=(lat-targetLat)**2+((lon-targetLon)*Math.cos(targetLat*Math.PI/180))**2;
      if(d<distance){distance=d;nearest=i;}
    });
    return nearest;
  },[manifest]);
  const activeIndex=selected??exampleIndex;
  const cell=manifest&&activeIndex!==null?manifest.cells[activeIndex]:null;
  const selectedValue=activeIndex!==null&&frame?frame.values[activeIndex]:null;
  const baseline=activeIndex!==null&&reference?reference[activeIndex]:null;
  const selectedLat=manifest&&cell?manifest.grid.lat[Math.floor(cell.index/manifest.grid.lon.length)]:null;
  const selectedLon=manifest&&cell?manifest.grid.lon[cell.index%manifest.grid.lon.length]:null;
  const index=manifest?.months.indexOf(month)??0;
  const chooseMonth=(value:string)=>{if(manifest?.months.includes(value))playback.select(value);};
  const select=(i:number)=>{setSelected(i);setSearchError("");};
  const searchForm=manifest?<form className="monthly-cell-search" onSubmit={e=>{e.preventDefault();const i=manifest.cells.findIndex(c=>c.id===search.trim());if(i<0)setSearchError("ID não encontrado na grade mensal.");else select(i);}}>
          <label htmlFor="monthly-cell-id">{t("Selecionar célula pelo ID nativo")}</label><div><input id="monthly-cell-id" value={search} onChange={e=>setSearch(e.target.value)} placeholder="imerg-monthly-v07:r…:c…"/>
            <button>{t("Selecionar célula")}</button></div>{searchError&&<p role="alert">{t(searchError)}</p>}
        </form>:null;
  return <section className={`exhibit monthly-explorer${compact?" is-compact":""}`} aria-label={t("Exploração mensal da chuva")}>
    <div className="exhibit-head">{!compact&&<p className="exhibit-tag">{t("Mapa mensal")}</p>}
      {compact?<h2 className="dossier-col-title">{t("Onde choveu mais ou menos")} <span aria-hidden="true">•</span> <small>{mode==="total"?t("Acumulado"):t("Anomalia")} {monthLabel(month,language)}</small></h2>
      :<h2>{mode==="total"?t("Chuva acumulada"):t("Anomalia de chuva")} · <span className="year-mark">{monthLabel(month,language)}</span></h2>}
      <div className="seg" role="tablist" aria-label={t("Modo do mapa mensal")}>
        <button className="seg-btn" role="tab" aria-selected={mode==="total"} onClick={()=>setMode("total")}>{t("Chuva mensal · mm")}</button>
        <button className="seg-btn" role="tab" aria-selected={mode==="anomaly"} onClick={()=>setMode("anomaly")}>{t("Anomalia · %")}</button>
      </div>
    </div>
    <div className="temporal-player" role="group" aria-label={t("Animação temporal mensal")}>
      <div className="player-main">
        <button className="play-button" onClick={playback.toggle} aria-pressed={playback.playing} disabled={!frame||!!error}>
          {playback.playing?`Ⅱ ${t("Pausar")}`:`▶ ${t("Reproduzir")}`}</button>
        <button className="step-button" aria-label={t("Mês anterior")} disabled={!manifest||index<=0} onClick={()=>playback.select(manifest!.months[index-1])}>‹</button>
        <output className="player-year" aria-label={t("Mês exibido")}>{monthLabel(month,language)}</output>
        <button className="step-button" aria-label={t("Próximo mês")} disabled={!manifest||index>=manifest.months.length-1} onClick={()=>playback.select(manifest!.months[index+1])}>›</button>
        <label className="player-speed">{t("Velocidade")} <select aria-label={t("Velocidade da animação mensal")} value={playback.speed} onChange={e=>playback.setSpeed(Number(e.target.value))}>
          <option value={.5}>{language==="pt"?"0,5×":"0.5×"}</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
        <label className="player-loop"><input type="checkbox" checked={playback.loop} onChange={e=>playback.setLoop(e.target.checked)}/> {t("Repetir")}</label>
        <label className="monthly-date">{t("Ir para o mês")} <input type="month" aria-label={t("Escolher mês da chuva")} min="2001-01" max="2024-12" value={month}
          disabled={!manifest} onInput={e=>chooseMonth(e.currentTarget.value)} onChange={e=>chooseMonth(e.currentTarget.value)}/></label>
      </div>
      <div className="player-track"><span>{language==="pt"?"jan":"Jan"}/2001</span><input type="range" aria-label={t("Selecionar mês da animação")} aria-valuetext={monthLabel(month,language)}
        min={0} max={287} step={1} value={index} disabled={!manifest} onChange={e=>playback.select(manifest!.months[Number(e.target.value)])}/><span>{language==="pt"?"dez":"Dec"}/2024</span></div>
      {!compact&&<p>{t("Um quadro por mês · 288 meses observados · carregamento em blocos anuais com antecipação dos próximos quadros.")}</p>}
    </div>
    {error?<div className="monthly-error" role="alert">{t(error)} <button onClick={()=>setRetry(v=>v+1)}>{t("Tentar novamente")}</button></div>:!manifest?<p role="status">{t("Carregando a grade e as referências mensais…")}</p>:null}
    {manifest&&<div className="map-layout">
      <div>
        <MonthlyRainMap manifest={manifest} values={error?null:frame?.values??null} month={month} mode={mode} selected={activeIndex} onSelect={select}/>
        <div className="legend monthly-legend" aria-label={t("Legenda do mapa mensal")}>
          <div className="legend-bar" style={{background:`linear-gradient(90deg,${(mode==="total"?TOTAL_STOPS:ANOMALY_STOPS).join(",")})`}}/>
          <div className="monthly-legend-labels">{mode==="total"?<><span>0 mm</span><span>≥600 mm/{language==="pt"?"mês":"month"}</span></>:<><span>≤−50%</span><span>{t("Referência")}</span><span>≥+50%</span></>}</div>
          <p className="muted">{t("Cinza: valor ou anomalia indisponível. A escala satura nos limites; o painel mostra o valor real.")}</p>
        </div>
        {compact?<details className="monthly-search-wrap"><summary>{t("Buscar célula pelo ID nativo")}</summary>{searchForm}</details>:searchForm}
      </div>
      <aside className="monthly-panel" aria-label={t("Leitura mensal")}>
        <p className="eyebrow">{monthLabel(month,language)} · {t("célula IMERG 0,1°")}</p>
        {cell?<>
          <h3>{t("Chuva na célula selecionada")}</h3><p className="monthly-big">{!frame||error?t("Aguardando dados"):number(selectedValue,language)}</p>
          <p className="muted">{t("Centro: {lat}° {latHemisphere} · {lon}° {lonHemisphere}. Esta leitura corresponde apenas a esta célula.").replace("{lat}",Math.abs(selectedLat!).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})).replace("{latHemisphere}",selectedLat!<0?"S":"N").replace("{lon}",Math.abs(selectedLon!).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})).replace("{lonHemisphere}",selectedLon!<0?(language==="pt"?"O":"W"):(language==="pt"?"L":"E"))}</p>
          {!frame||error?<p role="status">{t("Aguardando os valores deste mês.")}</p>:<dl className="monthly-readings"><dt>{t("Referência do mesmo mês")}</dt><dd>{number(baseline,language)}</dd>
            <dt>{t("Anomalia desta célula")}</dt><dd>{number(monthlyAnomaly(selectedValue,baseline),language,"%")}</dd>
            <dt>{t("Anos disponíveis na referência")}</dt><dd>{manifest.referenceCounts[month.slice(5,7)][activeIndex!]}/24</dd></dl>}
          <hr/><h3>{t("Série desta célula")}</h3><p className="mono monthly-id">{cell.id}</p>
          <p className="muted">{t("Clique em outra célula no mapa para atualizar a análise.")}</p>
          <MonthlyCellHistory manifest={manifest} id={cell.id} month={month} onSelectMonth={playback.select}/>
        </>:<p role="status">{t("Localizando a célula de exemplo…")}</p>}
        <details className="monthly-method"><summary>{t("Fonte e referência mensal")}</summary>
          <p>{manifest.metadata.productId} · {manifest.metadata.version} · {t("unidade: mm/mês.")}</p>
          <p>{t("Janeiro é comparado aos janeiros de 2001–2024, fevereiro aos fevereiros, e assim por diante. Exigimos 24 anos válidos para cada referência.")}</p>
          {manifest.metadata.qualityNotes.map(note=><p key={note}>{note}</p>)}
          <a href={`https://doi.org/${manifest.metadata.sourceDOI}`} target="_blank" rel="noreferrer">{t("Fonte NASA · DOI")}</a>
        </details>
      </aside>
    </div>}
    {!compact&&<p className="monthly-science-note">{t("Anomalia mensal descreve diferença em relação ao histórico. Não é teste de tendência, previsão de chuva ou avaliação de segurança de uma rota.")}</p>}
  </section>;
}
