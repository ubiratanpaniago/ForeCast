import { useEffect, useState } from "react";
import { fetchMonthlyCell, monthLabel, type MonthlyManifest, type MonthlyCellSeries } from "../services/monthlyApi";

export function MonthlyCellHistory({manifest,id,month,onSelectMonth}: {
  manifest:MonthlyManifest;id:string;month:string;onSelectMonth:(t:string)=>void;
}) {
  const [data,setData]=useState<MonthlyCellSeries|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const c=new AbortController();setData(null);setError("");
    fetchMonthlyCell(manifest,id,c.signal).then(d=>{if(!c.signal.aborted)setData(d);})
      .catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return ()=>c.abort();
  },[manifest,id,retry]);
  if(error)return <p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></p>;
  if(!data||data.cellId!==id||data.revision!==manifest.revision)return <p role="status">Consultando os 288 meses da célula…</p>;
  const max=Math.max(1,...data.series.flatMap(p=>[p.value??0,p.climatology??0]));
  const path=(key:"value"|"climatology")=>{
    let result="",connected=false;
    data.series.forEach((p,i)=>{const value=p[key];if(value===null){connected=false;return;}
      result+=`${connected?"L":"M"}${(i/(data.series.length-1)*600).toFixed(2)},${(120-value/max*115).toFixed(2)} `;connected=true;});
    return result;
  };
  const cursor=manifest.months.indexOf(month)/(manifest.months.length-1)*600;
  return <section className="monthly-cell-history" aria-label="Histórico mensal da célula selecionada">
    <h3>Série da célula · 2001–2024</h3>
    <svg viewBox="0 0 600 140" role="img" aria-label="Precipitação e referência mensal da célula; dados completos na tabela abaixo">
      <path d={path("climatology")} fill="none" stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={1.5}/>
      <path d={path("value")} fill="none" stroke="var(--wet)" strokeWidth={1.5}/>
      <line x1={cursor} x2={cursor} y1={0} y2={124} stroke="var(--accent)" strokeWidth={1.5}/>
      <text x={0} y={138} className="chart-tick">2001</text><text x={560} y={138} className="chart-tick">2024</text>
    </svg>
    <p className="muted">Azul: chuva mensal · tracejado: referência do mesmo mês · escala 0–{max.toFixed(0)} mm.</p>
    <details><summary>Consultar os 288 meses em tabela</summary>
      <div className="monthly-table-scroll"><table><thead><tr><th>Mês</th><th>Chuva (mm)</th><th>Referência (mm)</th><th>Anomalia</th></tr></thead>
      <tbody>{data.series.map(p=><tr key={p.t}><td><button className="inline-year" onClick={()=>onSelectMonth(p.t)}>{monthLabel(p.t)}</button></td>
        <td>{p.value===null?"Sem dados":p.value.toFixed(2)}</td><td>{p.climatology===null?"Indisponível":p.climatology.toFixed(2)}</td>
        <td>{p.anomalyPct===null?"Indisponível":`${p.anomalyPct.toFixed(1)}%`}</td></tr>)}</tbody></table></div>
    </details>
  </section>;
}
