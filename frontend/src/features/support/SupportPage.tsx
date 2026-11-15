import { useEffect, useRef, useState } from 'react';
import { SupportMap } from './SupportMap';
import { distanceKm, phoneHref, type SupportPoint } from './supportData';
import { useMonthlyRainfall } from '../dossier/hooks/useMonthlyRainfall';
import { monthlyAnomaly } from '../dossier/services/monthlyApi';
import { EXAMPLE_CELL_ID, placeName, rainDescription } from '../simple-home/homeData';
import { getRegionGeometry } from '../../services/regionApi';
import type { RegionsGeoJSON } from '../../types/geography';
import './support.css';

const format=(n:number|null)=>n===null?'Sem dados':`${n.toLocaleString('pt-BR',{maximumFractionDigits:0})} mm`;
// The calculated-point feed must be supplied by its actual producer. null means
// unavailable, not zero points found. No OSM POI substitution or inferred shelters.
export default function SupportPage({calculatedPoints=null}:{calculatedPoints?:SupportPoint[]|null}){
  const [selected,setSelected]=useState<string|null>(null),[cellId,setCellId]=useState(EXAMPLE_CELL_ID);
  const [roads,setRoads]=useState(false),[terrain,setTerrain]=useState(false);
  const [helpOpen,setHelpOpen]=useState(false),[helpMode,setHelpMode]=useState('donate');
  const [explainOpen,setExplainOpen]=useState(false),[retry,setRetry]=useState(0);
  const [regions,setRegions]=useState<RegionsGeoJSON|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),helpButton=useRef<HTMLButtonElement>(null);
  const evidenceDialog=useRef<HTMLDialogElement>(null),evidenceButton=useRef<HTMLButtonElement>(null);
  const {manifest,frame,error}=useMonthlyRainfall('2024-12',retry);
  useEffect(()=>{let active=true;void getRegionGeometry().then(d=>{if(active)setRegions(d);}).catch(()=>{});return()=>{active=false;};},[]);
  useEffect(()=>{const previous=document.title;document.title='ForeCast · Apoio';return ()=>{document.title=previous;};},[]);
  useEffect(()=>{if(helpOpen&&!dialog.current?.open)dialog.current?.showModal();},[helpOpen]);
  useEffect(()=>{if(explainOpen&&!evidenceDialog.current?.open)evidenceDialog.current?.showModal();},[explainOpen]);
  const index=manifest?.cells.findIndex(c=>c.id===cellId)??-1;
  const cell=index>=0?manifest!.cells[index]:null;
  const lat=cell?manifest!.grid.lat[Math.floor(cell.index/manifest!.grid.lon.length)]:-28.05;
  const lon=cell?manifest!.grid.lon[cell.index%manifest!.grid.lon.length]:-52.45;
  const location=placeName(regions,lon,lat);
  const origin={name:location,lat,lon};
  const points=(calculatedPoints??[]).map(p=>({...p,distance:distanceKm(origin,p)}));
  const nearest=[...points].sort((a,b)=>a.distance-b.distance)[0];
  const point=points.find(p=>p.id===selected)??nearest??null;
  const value=!error&&frame&&index>=0?frame.values[index]:null;
  const reference=manifest&&index>=0?manifest.climatology['12'][index]:null;
  const maximum=Math.max(value??0,reference??0,1);
  const phone=phoneHref(point?.phone??null);
  return <div className="support-page support-reference">
    <a className="support-skip" href="#support-content">Ir para o conteúdo</a>
    <header className="support-header">
      <a href="/" className="support-brand" aria-label="ForeCast, voltar ao início">ForeCast<span>.</span><small>Chuva, história e cuidado.</small></a>
      <div className="support-heading"><h1>Como encontrar apoio na sua região</h1><a href="/">← Voltar ao início</a></div>
      <a href="/apoio" aria-current="page" className="support-current">Apoio <span aria-hidden="true">↗</span></a>
    </header>
    <main className="support-body" id="support-content">
      <section className="support-map-panel" aria-label="Mapa do Sul do Brasil">
        {error?<div className="support-map-message" role="alert"><p>Não conseguimos carregar o mapa.</p><button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></div>
        :<SupportMap origin={origin} points={points} selected={point?.id??null} onSelect={setSelected} roads={roads} terrain={terrain} manifest={manifest} values={frame?.values??null} selectedCell={index>=0?index:null} onCellSelect={i=>{if(manifest){setCellId(manifest.cells[i].id);setSelected(null);}}}/>}
        <div className="support-map-controls" aria-label="Camadas do mapa"><span>Mostrar</span><button aria-pressed={roads} onClick={()=>setRoads(v=>!v)}>Estradas {roads?'✓':'＋'}</button><button aria-pressed={terrain} onClick={()=>setTerrain(v=>!v)}>Relevo {terrain?'✓':'＋'}</button></div>
        <div className="support-rain-legend"><span><i/>Menos chuva</span><span>Dezembro de 2024</span><span><i/>Mais chuva</span></div>
        <p className="support-map-footnote">Chuva histórica · NASA IMERG · Limites IBGE{roads?' · Rodovias do sistema':''}{terrain?' · Relevo: suscetibilidade a acúmulo de água, não altitude':''}</p>
      </section>
      <aside className="support-reference-info" aria-label="Apoio e sua região">
        <section className="support-nearest" aria-labelledby="support-nearest-title">
          <div className="support-section-title"><h2 id="support-nearest-title">Local mais próximo</h2><span>{location}</span></div>
          <div className="support-nearest-card">
            {point?<><h3>{point.name}</h3><p>{point.address}</p><div className="support-nearest-meta"><span>{point.distance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km em linha reta · {point.hours??'Horário não informado'}</span><a className="support-primary" href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`} target="_blank" rel="noopener noreferrer">Ver rota ↗</a></div></>
            :<><span className="support-eyebrow">PONTOS CALCULADOS PELO FORECAST</span><h3>Pontos de apoio indisponíveis</h3><p>Ainda não há uma indicação disponível para este lugar.</p><span className="support-empty-label">Sem indicação de rota</span></>}
          </div>
          <div className="support-nearest-actions"><button ref={evidenceButton} disabled={!point} onClick={()=>setExplainOpen(true)}>Por que este ponto foi indicado? ↗</button>{phone&&<a href={phone}>Ligar para o local ↗</a>}</div>
        </section>
        <section className="support-region" aria-labelledby="support-region-title">
          <div className="support-section-title"><h2 id="support-region-title">Sua região</h2><span>{location}</span></div>
          <p className="support-region-description">{rainDescription(monthlyAnomaly(value,reference))}</p>
          <div className="support-reference-bars">{[['Chuva registrada',value,'recorded'],['Média desse mês',reference,'average']].map(([label,n,kind])=><div className="support-reference-bar" key={String(label)}><span>{label}</span><div><i className={String(kind)} style={{width:`${n===null?0:Number(n)/maximum*100}%`}}/></div><strong>{format(n as number|null)}</strong></div>)}</div>
          <p className="support-period">Dezembro de 2024 · Referência: dezembros de 2001 a 2024</p>
          <div className="support-region-facts"><span>Previsão atual <strong>Não disponível</strong></span><span>Condição do acesso <strong>Não avaliada em tempo real</strong></span></div>
          <p className="support-coordinate">{cellId===EXAMPLE_CELL_ID?'Ponto de exemplo':'Ponto escolhido'}: {Math.abs(lat).toLocaleString('pt-BR',{maximumFractionDigits:2})}° S · {Math.abs(lon).toLocaleString('pt-BR',{maximumFractionDigits:2})}° O</p>
        </section>
        <button ref={helpButton} className="support-how" onClick={()=>setHelpOpen(true)}><strong>Como apoiar</strong><span>Doe · Seja voluntário · Ofereça recursos</span><i aria-hidden="true">↗</i></button>
      </aside>
    </main>
    <footer className="support-footer"><span>ForeCast · Paraná, Santa Catarina e Rio Grande do Sul</span><span>Dados históricos não confirmam abrigo ativo ou rota segura.</span></footer>
    <dialog ref={dialog} className="support-help-dialog" aria-labelledby="support-help-title" onClose={()=>{setHelpOpen(false);helpButton.current?.focus();}}>
      <div className="support-help-heading"><span className="support-eyebrow">CUIDAR TAMBÉM É PARTICIPAR</span><button aria-label="Fechar como apoiar" onClick={()=>dialog.current?.close()}>✕</button></div><h2 id="support-help-title">Como você quer apoiar?</h2><p>Combine a ajuda com quem está recebendo.</p>
      <div className="support-help-options">{[['donate','Doar'],['volunteer','Ser voluntário'],['resources','Oferecer recursos']].map(([id,label])=><button key={id} aria-pressed={helpMode===id} onClick={()=>setHelpMode(id)}>{label}</button>)}</div>
      <div className="support-help-copy" aria-live="polite">{helpMode==='donate'?<><h3>Descubra o que está fazendo falta.</h3><p>Consulte a instituição ou a prefeitura sobre itens necessários, endereço e horário de recebimento. Confirme quem organiza a campanha antes de enviar dinheiro.</p></>:helpMode==='volunteer'?<><h3>Ofereça seu tempo com orientação.</h3><p>Procure o cadastro de voluntários da prefeitura ou da instituição. Informe sua disponibilidade e suas habilidades. Aguarde a orientação antes de ir ao local.</p></>:<><h3>Conte com o que você pode contribuir.</h3><p>Transporte, equipamentos e espaço podem ajudar. Combine a necessidade, as condições de uso e a entrega diretamente com a organização responsável.</p></>}</div>
      <p className="support-help-note">Campanhas e vagas verificadas ainda não estão integradas ao ForeCast.</p><button className="support-primary" onClick={()=>dialog.current?.close()}>Voltar ao mapa</button>
    </dialog>
    <dialog ref={evidenceDialog} className="support-help-dialog" aria-labelledby="support-evidence-title" onClose={()=>{setExplainOpen(false);evidenceButton.current?.focus();}}><h2 id="support-evidence-title">Por que este ponto?</h2>{point?.criteria?.length?<div className="support-evidence">{point.criteria.map(c=><span key={c.label}>{c.label}<b>{c.value}</b></span>)}</div>:<p>Critérios da avaliação não disponíveis.</p>}{point?.source&&<p>Fonte: {point.source}</p>}{point?.calculatedAt&&<p>Avaliado em: {point.calculatedAt}</p>}<p>Funcionamento, lotação e acesso precisam de confirmação atual.</p><button className="support-primary" onClick={()=>evidenceDialog.current?.close()}>Voltar ao mapa</button></dialog>
  </div>;
}
