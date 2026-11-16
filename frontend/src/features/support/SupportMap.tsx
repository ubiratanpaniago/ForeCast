import { useEffect, useState } from 'react';
import { MonthlyRainMap } from '../dossier/components/MonthlyRainMap';
import type { MonthlyManifest } from '../dossier/services/monthlyApi';
import { getRoads, getTerrain } from '../../services/regionApi';
import type { Place, SupportPoint } from './supportData';
import { useLanguage } from '../../i18n/LanguageContext';

function geometryPath(g:GeoJSON.Geometry):string{
  const line=(coords:GeoJSON.Position[])=>coords.map(([x,y],i)=>`${i?'L':'M'}${x},${-y}`).join(' ');
  if(g.type==='LineString')return line(g.coordinates);
  if(g.type==='MultiLineString')return g.coordinates.map(line).join(' ');
  if(g.type==='Polygon')return g.coordinates.map(c=>line(c)+'Z').join(' ');
  if(g.type==='MultiPolygon')return g.coordinates.flatMap(p=>p.map(c=>line(c)+'Z')).join(' ');
  return '';
}
export function SupportMap({origin,points,selected,onSelect,roads,terrain,manifest,values,onCellSelect,selectedCell}:{
  origin:Place;points:SupportPoint[];selected:string|null;onSelect:(id:string)=>void;roads:boolean;terrain:boolean;
  manifest:MonthlyManifest|null;values:Array<number|null>|null;selectedCell:number|null;onCellSelect:(i:number)=>void;
}){
  const {t}=useLanguage();
  const [roadData,setRoadData]=useState<GeoJSON.FeatureCollection|null>(null);
  const [terrainData,setTerrainData]=useState<GeoJSON.FeatureCollection|null>(null);
  const [roadError,setRoadError]=useState(false),[terrainError,setTerrainError]=useState(false);
  useEffect(()=>{let active=true;if(roads&&!roadData){setRoadError(false);void getRoads().then(d=>{if(active)setRoadData(d as GeoJSON.FeatureCollection);}).catch(()=>{if(active)setRoadError(true);});}return ()=>{active=false;};},[roads,roadData]);
  useEffect(()=>{let active=true;if(terrain&&!terrainData){setTerrainError(false);void getTerrain().then(d=>{if(active)setTerrainData(d as GeoJSON.FeatureCollection);}).catch(()=>{if(active)setTerrainError(true);});}return ()=>{active=false;};},[terrain,terrainData]);
  if(!manifest)return <div className="support-map-message" role="status">{t('Carregando o mapa do Sul…')}</div>;
  const {lon,lat}=manifest.grid;
  const box=[lon[0]-.05,-lat[lat.length-1]-.05,lon[lon.length-1]-lon[0]+.1,lat[lat.length-1]-lat[0]+.1];
  const p=points.find(p=>p.id===selected);
  return <div className="support-south-map">
    <MonthlyRainMap manifest={manifest} values={values} month="2024-12" mode="anomaly" selected={selectedCell} onSelect={onCellSelect}
      overlay={<svg className="support-map-overlay" viewBox={box.join(' ')} preserveAspectRatio="none" aria-label={t('Pontos de apoio e camadas do sistema')}>
        {terrain&&terrainData?.features.map((f,i)=><path key={i} d={geometryPath(f.geometry)} fill={f.properties?.class===3?'#9a4a17':f.properties?.class===2?'#a99160':'#f2ede2'} fillOpacity={.5} fillRule="evenodd"/>)}
        {roads&&roadData?.features.map((f,i)=><path key={i} d={geometryPath(f.geometry)} fill="none" stroke="#1b1a16" strokeOpacity={.6} strokeWidth={.7} vectorEffect="non-scaling-stroke"/>)}
        {p&&<line x1={origin.lon} y1={-origin.lat} x2={p.lon} y2={-p.lat} stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray="5 4"/>}
        {points.map(point=><g key={point.id} className="support-point-marker" role="button" tabIndex={0} aria-label={`${t('Selecionar ponto de apoio')} ${point.name}`} onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect(point.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onSelect(point.id);}}}>
          <circle cx={point.lon} cy={-point.lat} r={point.id===selected ? .14 : .1} fill="var(--accent)" stroke="var(--card)" strokeWidth={3} vectorEffect="non-scaling-stroke"/>
        </g>)}
      </svg>}/>
    {(roadError||terrainError)&&<p className="support-layer-note" role="status">{roadError?`${t('Estradas indisponíveis.')} `:''}{terrainError?t('Relevo indisponível.'):''}</p>}
    {(roads&&!roadData&&!roadError||terrain&&!terrainData&&!terrainError)&&<p className="support-layer-note" role="status">{t('Carregando camada do sistema…')}</p>}
  </div>;
}
