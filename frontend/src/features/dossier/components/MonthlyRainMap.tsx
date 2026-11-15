import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { SouthContext } from "./Map/SouthContext";
import { Graticule, GraticuleLabels } from "./Map/MapLayers";
import { anomalyColor, monthlyTotalColor } from "../lib/color";
import { monthlyAnomaly, monthLabel, type MonthlyManifest } from "../services/monthlyApi";

export function MonthlyRainMap({manifest,values,month,mode,selected,onSelect,overlay}: {
  manifest:MonthlyManifest; values:Array<number|null>|null; month:string; mode:"total"|"anomaly";
  selected:number|null; onSelect:(index:number)=>void;
  overlay?: ReactNode;
}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const {grid,cells}=manifest;
  const width=grid.lon.length,height=grid.lat.length;
  const bbox=useMemo(()=>({west:grid.lon[0]-.05,east:grid.lon[width-1]+.05,south:grid.lat[0]-.05,north:grid.lat[height-1]+.05}),[grid,width,height]);
  const byIndex=useMemo(()=>new Map(cells.map((c,i)=>[c.index,i])),[cells]);
  const reference=manifest.climatology[month.slice(5,7)];
  useEffect(()=>{
    const ctx=canvas.current?.getContext("2d");
    if(!ctx) return;
    ctx.clearRect(0,0,width,height);
    if(!values) return;
    const image=ctx.createImageData(width,height);
    cells.forEach((cell,i)=>{
      const v=mode==="total"?values[i]:monthlyAnomaly(values[i],reference[i]);
      const color=v===null?[122,116,102]:mode==="total"?monthlyTotalColor(v):anomalyColor(v);
      const row=Math.floor(cell.index/width),column=cell.index%width,p=((height-1-row)*width+column)*4;
      image.data[p]=color[0];image.data[p+1]=color[1];image.data[p+2]=color[2];image.data[p+3]=255;
    });
    ctx.putImageData(image,0,0);
  },[values,reference,mode,cells,width,height]);
  const selectedCell=selected===null?null:cells[selected];
  const row=selectedCell?Math.floor(selectedCell.index/width):0,column=selectedCell?selectedCell.index%width:0;
  return <div className="map-frame">
    <div className="map" role="group" tabIndex={0}
      aria-label={`Mapa mensal de ${mode==="total"?"chuva":"anomalia"}, ${monthLabel(month)}. Use as setas para selecionar células nativas.`}
      style={{aspectRatio:String((bbox.east-bbox.west)*Math.cos(28*Math.PI/180)/(bbox.north-bbox.south)),maxWidth:"74dvh"}}
      onPointerDown={e=>{
        if(!values) return;
        const r=e.currentTarget.getBoundingClientRect();
        const col=Math.floor((e.clientX-r.left)/r.width*width),rowFromNorth=Math.floor((e.clientY-r.top)/r.height*height);
        if(col<0||col>=width||rowFromNorth<0||rowFromNorth>=height)return;
        const i=byIndex.get((height-1-rowFromNorth)*width+col);
        if(i!==undefined)onSelect(i);
      }}
      onKeyDown={e=>{
        if(!["ArrowRight","ArrowLeft","ArrowUp","ArrowDown","Enter"].includes(e.key))return;
        e.preventDefault();
        if(selected===null) {onSelect(Math.floor(cells.length/2));return;}
        const delta=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:e.key==="ArrowUp"?width:e.key==="ArrowDown"?-width:0;
        let index=cells[selected].index+delta;
        while(delta!==0&&index>=0&&index<width*height) {
          if(Math.abs(delta)===1&&Math.floor(index/width)!==Math.floor(cells[selected].index/width))break;
          const next=byIndex.get(index);if(next!==undefined){onSelect(next);break;}index+=delta;
        }
      }}>
      <canvas ref={canvas} className="map-raster" width={width} height={height} aria-hidden="true" />
      <svg className="map-overlay" viewBox={`${bbox.west} ${-bbox.north} ${bbox.east-bbox.west} ${bbox.north-bbox.south}`} preserveAspectRatio="none" aria-hidden="true">
        <Graticule bbox={bbox} /><SouthContext bbox={bbox} highlight={false} />
        {selectedCell&&<rect x={grid.lon[column]-.05} y={-grid.lat[row]-.05} width={.1} height={.1}
          fill="none" stroke="var(--accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      <GraticuleLabels bbox={bbox} />
      {overlay}
      {!values&&<div className="monthly-map-loading" role="status">Carregando {monthLabel(month)}…</div>}
    </div>
    <p className="map-focus-note">IMERG 0,1° · células nativas inteiras com interseção em PR/SC/RS · limites IBGE simplificados.</p>
  </div>;
}
