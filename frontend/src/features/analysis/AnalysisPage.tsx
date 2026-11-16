import { useCallback, useMemo, useState } from 'react';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import { useInfrastructure, useRegionGeometry } from '../../hooks/useRegionalTrends';
import { RegionalMap, type Layers, type Selection } from '../regional/components/RegionalMap';
import { TopNavigation } from '../../components/TopNavigation';
import { useLanguage } from '../../i18n/LanguageContext';
import './analysis.css';

const km=(n:number,locale:string)=>`${Math.round(n).toLocaleString(locale)} km`;
export default function AnalysisPage(){
  const {t,language}=useLanguage();
  const locale=language==='en'?'en-US':'pt-BR';
  const [layers,setLayers]=useState<Layers>({roads:true,terrain:true,crossings:true});
  const [selection,setSelection]=useState<Selection>(null);
  const infra=useInfrastructure(layers),regions=useRegionGeometry();
  const roads=infra.roads.status==='ready'?infra.roads.data:null;
  const crossings=infra.crossings.status==='ready'?infra.crossings.data:null;
  const selected=selection?.kind==='segment'?roads?.features.find(f=>f.properties.id===selection.id)?.properties:
    selection?.kind==='crossing'?roads?.features.find(f=>f.properties.id===selection.segmentId)?.properties:null;
  const selectedCrossing=selection?.kind==='crossing'?crossings?.features.find(f=>f.properties.id===selection.id)?.properties:null;
  const totals=infra.catalog.status==='ready'?infra.catalog.data.totals:null;
  const toggle=(key:keyof Layers)=>setLayers(prev=>({...prev,[key]:!prev[key]}));
  const color=useCallback(()=>null,[]);
  const tooltip=useCallback((f:MapGeoJSONFeature)=>{
    const p=f.properties as Record<string,unknown>;
    if(f.layer.id==='crossing-dot')return language==='en'?`Location to investigate · ${p.ref} · ${p.lengthKm} km segment`:`Ponto para investigar · ${p.ref} · trecho ${p.lengthKm} km`;
    if(f.layer.id==='road-line')return language==='en'?`${p.ref} · ${p.regionName} · ${p.lengthKm} km segment`:`${p.ref} · ${p.regionName} · trecho ${p.lengthKm} km`;
    return typeof p.name==='string'?p.name:null;
  },[language]);
  const layersData=useMemo(()=>({
    roads:roads as unknown as GeoJSON.FeatureCollection|null,
    crossings:crossings as unknown as GeoJSON.FeatureCollection|null,
    terrain:(infra.terrain.status==='ready'?infra.terrain.data:null) as unknown as GeoJSON.FeatureCollection|null,
  }),[roads,crossings,infra.terrain]);
  return <div className="analysis-page">
    <TopNavigation page="analysis" title="Chuva e estradas" subtitle="Veja as estradas e os pontos que merecem investigação." />
    <main className="analysis-main">
      <section className="analysis-map-area" aria-label={t("Mapa e camadas")}>
        <div className="analysis-map-heading"><div><h2>{t("O que existe na sua região?")}</h2><p>{t("Linhas mostram estradas mapeadas; círculos mostram pontos para investigar.")}</p></div><div className="analysis-switches" role="group" aria-label={t("Camadas do mapa")}>
          {([['roads','Estradas'],['terrain','Relevo'],['crossings','Pontos para investigar']] as const).map(([key,label])=><button key={key} aria-pressed={layers[key]} onClick={()=>toggle(key)}>{t(label)}<span aria-hidden="true">{layers[key]?'✓':'＋'}</span></button>)}
        </div></div>
        <div className="analysis-map-frame"><RegionalMap regions={regions.status==='ready'?regions.data:null} regionColor={color} colorKey="none" terrain={layersData.terrain} roads={layersData.roads} crossings={layersData.crossings} layers={layers} selection={selection} onSelect={setSelection} tooltip={tooltip}/></div>
        <div className="analysis-legend"><span><i className="analysis-road-key"/> {t("Estradas")}</span><span><i className="analysis-federal-key"/> {t("BR federal")}</span>{layers.crossings&&<span><i className="analysis-cross-key"/> {t("Ponto para investigar")}</span>}{layers.terrain&&<span><i className="analysis-terrain-key"/> {t("Relevo: área suscetível")}</span>}</div>
        <p className="analysis-source">{t("Rodovias: OpenStreetMap · Relevo: NASADEM · Limites: IBGE")}</p>
      </section>
      <aside className="analysis-panel" aria-live="polite">
        {selected?<>
          <span className="analysis-eyebrow">{t("TRECHO SELECIONADO")}</span><h2>{selected.ref}</h2><p className="analysis-place">{selected.regionName} · {selected.uf}</p>
          <div className="analysis-stat"><strong>{km(selected.lengthKm,locale)}</strong><span>{t("de estrada neste trecho")}</span></div>
          <div className="analysis-facts"><div><span>{t("Parte em relevo de atenção")}</span><strong>{selected.shareHigh===null?t("Sem dados"):`${Math.round(selected.shareHigh*100)}%`}</strong></div><div><span>{t("Pontos para investigar")}</span><strong>{selected.crossingCount.toLocaleString(locale)}</strong></div></div>
          {selectedCrossing&&<div className="analysis-cross-detail"><strong>{t("Ponto para investigar")}</strong><p>{selectedCrossing.ref}: {selectedCrossing.lengthKm.toLocaleString(locale,{maximumFractionDigits:1})} km {language==='en'?"of this segment cross a high-susceptibility cell.":"do trecho cruzam uma célula de alta suscetibilidade."}</p>{selectedCrossing.elevationMeanM!==null&&<small>{t("Elevação média estimada:")} {selectedCrossing.elevationMeanM.toLocaleString(locale)} m</small>}</div>}
          <button className="analysis-clear" onClick={()=>setSelection(null)}>{t("Limpar seleção")}</button>
        </>:<>
          <span className="analysis-eyebrow">{t("VISÃO GERAL")}</span><h2>{t("Estradas que merecem atenção")}</h2>
          {infra.catalog.status==='loading'?<p className="analysis-loading">{t("Carregando informações das estradas…")}</p>:infra.catalog.status==='error'?<p className="analysis-warning">{t("Não conseguimos carregar os dados das estradas. Confira se o serviço de dados está disponível.")}</p>:totals&&<>
            <p className="analysis-big"><strong>{totals.segments.toLocaleString(locale)}</strong><span>{t("trechos de estrada no mapa")}</span></p>
            <div className="analysis-facts"><div><span>{t("Extensão mapeada")}</span><strong>{km(totals.lengthKm,locale)}</strong></div><div><span>{t("Pontos que pedem investigação")}</span><strong>{totals.crossings.toLocaleString(locale)}</strong></div></div>
            <p className="analysis-explain">{t("As linhas marcam estradas registradas no OpenStreetMap. Os círculos mostram cruzamentos com áreas de relevo que podem favorecer o acúmulo de água. São locais para investigar, não alagamentos confirmados.")}</p>
          </>}
          <div className="analysis-important"><span aria-hidden="true">i</span><p><strong>{t("O que este mapa não confirma")}</strong>{t("Ele não mostra alagamentos acontecendo, bloqueios de estrada nem rotas seguras.")}</p></div>
          <div className="analysis-help"><strong>{t("Como explorar")}</strong><p>{t("Ative “Relevo” para ver as áreas estudadas. Ative “Pontos para investigar” e selecione um trecho da estrada para conhecer os dados.")}</p></div>
        </>}
      </aside>
    </main>
    <footer className="analysis-footer"><span>{t("ForeCast · Paraná, Santa Catarina e Rio Grande do Sul")}</span><span>{t("Estimativa exploratória · Sem alerta em tempo real")}</span></footer>
  </div>;
}
