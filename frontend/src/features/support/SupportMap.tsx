import { useEffect, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, AttributionControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Place, SupportPoint } from './supportData';
setWorkerUrl(workerUrl);

export function SupportMap({origin,points,selected,onSelect,roads,terrain}:{
  origin:Place;points:SupportPoint[];selected:string|null;onSelect:(id:string)=>void;roads:boolean;terrain:boolean;
}) {
  const host=useRef<HTMLDivElement>(null), map=useRef<Map|null>(null);
  const [ready,setReady]=useState(false), [error,setError]=useState('');
  const [tileError,setTileError]=useState(false);
  useEffect(()=>{
    if (!host.current) return;
    let m:Map;
    try {
      m=new Map({container:host.current,center:[origin.lon,origin.lat],zoom:11,attributionControl:false,dragRotate:false,
        style:{version:8,sources:{},layers:[{id:'paper',type:'background',paint:{'background-color':'#e9e2d3'}}]}});
    } catch {setError('Mapa indisponível neste navegador.');return;}
    map.current=m;
    m.addControl(new NavigationControl({showCompass:false}),'top-right');
    m.addControl(new AttributionControl({compact:true}));
    m.on('load',()=>setReady(true));
    m.on('error',()=>setTileError(true));
    const resize=new ResizeObserver(()=>m.resize());resize.observe(host.current);
    return ()=>{resize.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    // Public tile providers are only contacted when the respective layer is enabled.
    if(roads&&!m.getSource('streets')){
      m.addSource('streets',{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
      m.addLayer({id:'streets',type:'raster',source:'streets',paint:{'raster-saturation':-.8,'raster-opacity':.85}},m.getLayer('shade')?'shade':undefined);
    }
    if(terrain&&!m.getSource('elevation')){
      m.addSource('elevation',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Relevo: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Mapzen / fontes de elevação</a>'});
      m.addLayer({id:'shade',type:'hillshade',source:'elevation',paint:{'hillshade-exaggeration':.65,'hillshade-shadow-color':'#675846','hillshade-highlight-color':'#fffdf7'}});
    }
    if(m.getLayer('streets'))m.setLayoutProperty('streets','visibility',roads?'visible':'none');
    if(m.getLayer('shade'))m.setLayoutProperty('shade','visibility',terrain?'visible':'none');
  },[ready,roads,terrain]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    m.jumpTo({center:[origin.lon,origin.lat],zoom:11});
    const el=document.createElement('span');el.className='support-origin';el.title='Centro da cidade de exemplo';
    const marker=new Marker({element:el}).setLngLat([origin.lon,origin.lat]).addTo(m);
    return ()=>{marker.remove();};
  },[ready,origin]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    const markers=points.map((p,i)=>{
      const el=document.createElement('button');el.type='button';el.className=`support-pin ${p.id===selected?'is-selected':''}`;
      el.textContent=String(i+1);el.setAttribute('aria-label',`${p.name}. ${p.id===selected?'Selecionado. ':''}Funcionamento não confirmado.`);
      el.setAttribute('aria-pressed',String(p.id===selected));el.onclick=()=>onSelect(p.id);
      return new Marker({element:el}).setLngLat([p.lon,p.lat]).addTo(m);
    });
    return ()=>markers.forEach(marker=>marker.remove());
  },[ready,points,selected,onSelect]);
  useEffect(()=>{
    const p=points.find(p=>p.id===selected);if(ready&&p)map.current?.easeTo({center:[p.lon,p.lat],duration:0});
  },[ready,selected,points]);
  return <div className="support-map"><div ref={host} className="support-map-canvas" role="region" aria-label="Mapa de locais de referência, estradas e relevo"/>
    {!ready&&!error&&<div className="support-map-message" role="status">Carregando o mapa…</div>}
    {error&&<div className="support-map-message" role="alert">O navegador não conseguiu mostrar o mapa. Consulte os locais no painel ao lado.</div>}
    {tileError&&<p className="support-tile-error" role="status">Uma camada do mapa não carregou. Verifique sua conexão.</p>}
  </div>;
}
