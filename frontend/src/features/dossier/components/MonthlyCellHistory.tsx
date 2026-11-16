import { useEffect, useState } from "react";
import { fetchMonthlyCell, monthLabel, type MonthlyManifest, type MonthlyCellSeries } from "../services/monthlyApi";
import { useLanguage } from "../../../i18n/LanguageContext";

export function MonthlyCellHistory({manifest,id,month,onSelectMonth}: {
  manifest:MonthlyManifest;id:string;month:string;onSelectMonth:(t:string)=>void;
}) {
  const { language, t } = useLanguage();
  const locale = language === "pt" ? "pt-BR" : "en-US";
  const [data,setData]=useState<MonthlyCellSeries|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const c=new AbortController();setData(null);setError("");
    fetchMonthlyCell(manifest,id,c.signal).then(d=>{if(!c.signal.aborted)setData(d);})
      .catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return ()=>c.abort();
  },[manifest,id,retry]);
  if(error)return <p role="alert">{t(error)} <button onClick={()=>setRetry(v=>v+1)}>{t("Tentar novamente")}</button></p>;
  if(!data||data.cellId!==id||data.revision!==manifest.revision)return <p role="status">{t("Consultando os 288 meses da célula…")}</p>;
  const max=Math.max(1,...data.series.flatMap(p=>[p.value??0,p.climatology??0]));
  const path=(key:"value"|"climatology")=>{
    let result="",connected=false;
    data.series.forEach((p,i)=>{const value=p[key];if(value===null){connected=false;return;}
      result+=`${connected?"L":"M"}${(i/(data.series.length-1)*600).toFixed(2)},${(120-value/max*115).toFixed(2)} `;connected=true;});
    return result;
  };
  const cursor=manifest.months.indexOf(month)/(manifest.months.length-1)*600;
  return <section className="monthly-cell-history" aria-label={t("Histórico mensal da célula selecionada")}>
    <h3>{t("Série da célula · 2001–2024")}</h3>
    <svg viewBox="0 0 600 140" role="img" aria-label={t("Precipitação e referência mensal da célula; dados completos na tabela abaixo")}>
      <path d={path("climatology")} fill="none" stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={1.5}/>
      <path d={path("value")} fill="none" stroke="var(--wet)" strokeWidth={1.5}/>
      <line x1={cursor} x2={cursor} y1={0} y2={124} stroke="var(--accent)" strokeWidth={1.5}/>
      <text x={0} y={138} className="chart-tick">2001</text><text x={560} y={138} className="chart-tick">2024</text>
    </svg>
    <p className="muted">{t("Azul: chuva mensal · tracejado: referência do mesmo mês · escala 0–{maximum} mm.").replace("{maximum}", max.toLocaleString(locale, { maximumFractionDigits: 0 }))}</p>
    <details><summary>{t("Consultar os 288 meses em tabela")}</summary>
      <div className="monthly-table-scroll"><table><thead><tr><th>{t("Mês")}</th><th>{t("Chuva (mm)")}</th><th>{t("Referência (mm)")}</th><th>{t("Anomalia")}</th></tr></thead>
      <tbody>{data.series.map(p=><tr key={p.t}><td><button className="inline-year" onClick={()=>onSelectMonth(p.t)}>{monthLabel(p.t, language)}</button></td>
        <td>{p.value===null?t("Sem dados"):p.value.toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>{p.climatology===null?t("Indisponível"):p.climatology.toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td>{p.anomalyPct===null?t("Indisponível"):`${p.anomalyPct.toLocaleString(locale,{minimumFractionDigits:1,maximumFractionDigits:1})}%`}</td></tr>)}</tbody></table></div>
    </details>
  </section>;
}
