import { useCallback, useEffect, useRef, useState } from 'react';
import { SupportMap } from './SupportMap';
import { CITIES, KIND_LABEL, findPoints, phoneHref, type SupportPoint } from './supportData';
import './support.css';

const PER_PAGE=2;
type Tab='details'|'access'|'evidence';
export default function SupportPage(){
  const [cityIndex,setCityIndex]=useState(0), [points,setPoints]=useState<SupportPoint[]>([]);
  const [selected,setSelected]=useState<string|null>(null), [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [error,setError]=useState(''), [retry,setRetry]=useState(0), [page,setPage]=useState(0);
  const [filter,setFilter]=useState('all'),[tab,setTab]=useState<Tab>('details');
  const [roads,setRoads]=useState(true),[terrain,setTerrain]=useState(false);
  const [helpOpen,setHelpOpen]=useState(false),[helpMode,setHelpMode]=useState('donate');
  const [queriedAt,setQueriedAt]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),helpButton=useRef<HTMLButtonElement>(null);
  const origin=CITIES[cityIndex];
  useEffect(()=>{const previous=document.title;document.title='ForeCast · Encontre apoio';return ()=>{document.title=previous;};},[]);
  useEffect(()=>{
    const abort=new AbortController();setStatus('loading');setPoints([]);setSelected(null);setPage(0);setError('');
    void findPoints(origin,abort.signal).then(data=>{
      if(abort.signal.aborted)return;
      setPoints(data);setSelected(data[0]?.id??null);setStatus('ready');setQueriedAt(new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
    }).catch(e=>{if(!abort.signal.aborted){setStatus('error');setError(e instanceof Error?e.message:'Não foi possível consultar os locais.');}});
    return ()=>abort.abort();
  },[origin,retry]);
  useEffect(()=>{if(helpOpen&&!dialog.current?.open)dialog.current?.showModal();},[helpOpen]);
  const filtered=points.filter(p=>filter==='all'||p.kind===filter);
  const visible=filtered.slice(page*PER_PAGE,(page+1)*PER_PAGE);
  const point=filtered.find(p=>p.id===selected)??null;
  const choose=useCallback((id:string)=>{setSelected(id);setTab('details');},[]);
  const changeFilter=(value:string)=>{setFilter(value);setPage(0);setSelected(points.find(p=>value==='all'||p.kind===value)?.id??null);};
  const href=phoneHref(point?.phone??null);
  return <div className="support-page">
    <a className="support-skip" href="#support-content">Ir para os locais</a>
    <header className="support-header">
      <a href="/" className="support-brand" aria-label="ForeCast, voltar ao início">ForeCast<span>.</span><small>← Voltar ao início</small></a>
      <div className="support-heading"><span className="support-eyebrow">ESTAMOS AQUI PARA AJUDAR</span><h1>Encontre apoio na sua região</h1></div>
      <button className="support-contribute" ref={helpButton} onClick={()=>setHelpOpen(true)}><span aria-hidden="true">＋</span><span>Como apoiar<small>Doe, participe, ofereça ajuda</small></span><span aria-hidden="true">↗</span></button>
    </header>
    <main className="support-body" id="support-content">
      <section className="support-map-panel" aria-label="Localização e mapa">
        <div className="support-location"><label htmlFor="support-city">Onde você quer buscar?</label><select id="support-city" value={cityIndex} onChange={e=>{setCityIndex(Number(e.target.value));setTab('details');}}>{CITIES.map((c,i)=><option key={c.name} value={i}>{c.name}</option>)}</select><small>Centro da cidade como exemplo · busca em até 15 km</small></div>
        <div className="support-map-wrap"><SupportMap origin={origin} points={filtered} selected={selected} onSelect={choose} roads={roads} terrain={terrain}/>
          <div className="support-map-caption"><span className="support-origin-key"/> Cidade de exemplo <span className="support-pin-key">1</span> Local a verificar</div>
        </div>
        <div className="support-map-controls" aria-label="Camadas do mapa"><span>Mostrar no mapa</span><button aria-pressed={roads} onClick={()=>setRoads(v=>!v)}>Estradas <span aria-hidden="true">{roads?'✓':'＋'}</span></button><button aria-pressed={terrain} onClick={()=>setTerrain(v=>!v)}>Relevo <span aria-hidden="true">{terrain?'✓':'＋'}</span></button></div>
        <p className="support-map-footnote">Estradas não indicam vias liberadas. O relevo não confirma a segurança de um local.</p>
      </section>
      <aside className="support-info" aria-label="Locais e orientações">
        <section className={`support-nearby ${tab!=='details'&&point?'is-compact':''}`} aria-labelledby="support-nearby-title">
          <div className="support-section-title"><h2 id="support-nearby-title">Locais próximos</h2><span>{status==='ready'?`${filtered.length} encontrados`:'Busca local'}</span></div>
          <div className="support-filter"><label htmlFor="support-kind">Preciso de</label><select id="support-kind" value={filter} onChange={e=>changeFilter(e.target.value)}><option value="all">Todos os locais</option><option value="shelter">Acolhimento</option><option value="health">Saúde</option><option value="fire">Bombeiros</option></select></div>
          <div className="support-results" aria-live="polite">
            {status==='loading'?<div className="support-empty"><span className="support-loader"/>Buscando locais cadastrados…<small>Consultando o OpenStreetMap.</small></div>
            :status==='error'?<div className="support-empty" role="alert"><strong>Não conseguimos buscar agora.</strong><small>{error}</small><button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></div>
            :!filtered.length?<div className="support-empty"><strong>Nenhum local encontrado nesta busca.</strong><small>Isso não significa que não exista apoio. Tente outra categoria ou consulte a prefeitura.</small></div>
            :visible.map(p=><button className={`support-result ${selected===p.id?'is-selected':''}`} key={p.id} onClick={()=>choose(p.id)} aria-pressed={selected===p.id}>
              <span className="support-result-number">{filtered.indexOf(p)+1}</span><span><strong>{p.name}</strong><small>{KIND_LABEL[p.kind]} · {p.distance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km em linha reta</small></span><span aria-hidden="true">→</span></button>)}
          </div>
          <div className="support-pagination"><span>{status==='ready'&&filtered.length?`${page*PER_PAGE+1}–${Math.min((page+1)*PER_PAGE,filtered.length)} de ${filtered.length}`:'Fonte: OpenStreetMap'}</span><div><button aria-label="Locais anteriores" disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><button aria-label="Próximos locais" disabled={(page+1)*PER_PAGE>=filtered.length} onClick={()=>setPage(p=>p+1)}>→</button></div></div>
        </section>
        <section className="support-point" aria-label="Informações do local selecionado">
          <div className="support-tabs" role="tablist" aria-label="Informações do ponto">{([['details','O local'],['access','Como chegar'],['evidence','Por que aparece?']] as const).map(([id,label])=><button key={id} role="tab" id={`tab-${id}`} aria-controls="support-tab-panel" aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
          <div className="support-tab-content" id="support-tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {!point?<div className="support-empty"><h3>Escolha um local no mapa ou na lista.</h3><p>Aqui você verá o endereço, o contato e a origem das informações.</p></div>
            :tab==='details'?<><span className="support-status">Funcionamento não confirmado</span><h3>{point.name}</h3><p className="support-address">{point.address}</p><div className="support-facts"><span>Horário<strong>{point.hours??'Não informado'}</strong></span><span>Acesso com cadeira de rodas<strong>{point.wheelchair==='yes'?'Consta no cadastro':point.wheelchair==='no'?'Não disponível no cadastro':'A confirmar'}</strong></span></div><div className="support-point-actions">{href?<a href={href} className="support-primary">Ligar para o local ↗</a>:<span className="support-no-contact">Telefone não informado</span>}<button onClick={()=>setTab('access')}>Ver acesso →</button></div></>
            :tab==='access'?<><span className="support-eyebrow">ANTES DE SAIR</span><h3>Confira o acesso ao local</h3><p>{point.distance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km em linha reta do centro de {origin.name}. A distância pela estrada pode ser maior.</p><div className="support-access-state"><span>Bloqueios e alagamentos</span><strong>Sem informação em tempo real</strong></div><p>Confirme o funcionamento e as vias de acesso com o local ou os órgãos responsáveis.</p><a className="support-primary" href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`} target="_blank" rel="noopener noreferrer">Consultar trajeto no Google Maps ↗</a><small className="support-external-note">Abre outro serviço. O ForeCast não verificou a segurança do trajeto.</small></>
            :<><span className="support-eyebrow">ORIGEM DA INDICAÇÃO</span><h3>Um cadastro, ainda não uma confirmação</h3><p>Este local aparece por estar cadastrado como <strong>{KIND_LABEL[point.kind].toLocaleLowerCase('pt-BR')}</strong> a até 15 km da cidade escolhida.</p><div className="support-evidence"><span>Cadastro geográfico <b>Disponível</b></span><span>Abrigo ativo para este evento <b>Não confirmado</b></span><span>Lotação e acesso seguro <b>Não avaliados</b></span></div><p className="support-source">Chuva e relevo não foram usados para classificar este ponto como seguro. Consulta às {queriedAt}; revisão do cadastro: {point.checked??'não informada'}.</p><a href={`https://www.openstreetmap.org/${point.id}`} target="_blank" rel="noopener noreferrer">Ver cadastro e informar correção ↗</a></>}
          </div>
        </section>
        <div className="support-confirmation"><span aria-hidden="true">○</span><p><strong>Confirme antes de se deslocar.</strong> Ainda não temos uma lista oficial de abrigos ativos para este evento.</p></div>
      </aside>
    </main>
    <footer className="support-footer"><span>ForeCast · Apoio no Sul do Brasil</span><span>Locais: OpenStreetMap · Relevo: Mapzen · Sem monitoramento de emergência</span></footer>
    <dialog ref={dialog} className="support-help-dialog" aria-labelledby="support-help-title" onClose={()=>{setHelpOpen(false);helpButton.current?.focus();}}>
      <div className="support-help-heading"><span className="support-eyebrow">CUIDAR TAMBÉM É PARTICIPAR</span><button aria-label="Fechar como apoiar" onClick={()=>dialog.current?.close()}>✕</button></div><h2 id="support-help-title">Como você quer apoiar?</h2><p>Combine a ajuda com quem está recebendo.</p>
      <div className="support-help-options">{[['donate','Doar'],['volunteer','Ser voluntário'],['resources','Oferecer recursos']].map(([id,label])=><button key={id} aria-pressed={helpMode===id} onClick={()=>setHelpMode(id)}>{label}</button>)}</div>
      <div className="support-help-copy" aria-live="polite">{helpMode==='donate'?<><h3>Descubra o que está fazendo falta.</h3><p>Consulte a instituição ou a prefeitura sobre itens necessários, endereço e horário de recebimento. Confirme quem organiza a campanha antes de enviar dinheiro.</p></>:helpMode==='volunteer'?<><h3>Ofereça seu tempo com orientação.</h3><p>Procure o cadastro de voluntários da prefeitura ou da instituição. Informe sua disponibilidade e suas habilidades. Aguarde a orientação antes de ir ao local.</p></>:<><h3>Conte com o que você pode contribuir.</h3><p>Transporte, equipamentos e espaço podem ajudar. Combine a necessidade, as condições de uso e a entrega diretamente com a organização responsável.</p></>}</div>
      <p className="support-help-note">Campanhas e vagas verificadas ainda não estão integradas ao ForeCast.</p><button className="support-primary" onClick={()=>dialog.current?.close()}>Voltar aos locais</button>
    </dialog>
  </div>;
}
