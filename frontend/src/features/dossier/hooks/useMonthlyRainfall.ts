import { useEffect, useState } from "react";
import { fetchMonthlyManifest, MonthlyFrameStore, type MonthlyYear } from "../services/monthlyApi";

export function useMonthlyRainfall(month: string, retry: number) {
  const [store,setStore] = useState<MonthlyFrameStore|null>(null);
  const [chunk,setChunk] = useState<MonthlyYear|null>(null);
  const [error,setError] = useState("");
  useEffect(()=>{
    const controller = new AbortController();
    let source: MonthlyFrameStore | undefined;
    setStore(null); setChunk(null); setError("");
    fetchMonthlyManifest(controller.signal).then(m=>{
      if (!controller.signal.aborted) { source=new MonthlyFrameStore(m); setStore(source); }
    }).catch(e=>{if(!controller.signal.aborted) setError(e.message);});
    return ()=>{controller.abort();source?.dispose();};
  },[retry]);
  const year = Number(month.slice(0,4));
  useEffect(()=>{
    let active=true;
    if(!store) return;
    setError("");
    store.load(year).then(y=>{
      if(active) setChunk(y);
      for(const adjacent of [year>2001?year-1:2024,year<2024?year+1:2001])
        void store.load(adjacent).catch(()=>{});
    }).catch(e=>{if(active) setError(e.message);});
    return ()=>{active=false;};
  },[store,year,retry]);
  const frame=chunk?.revision===store?.manifest.revision && chunk?.year===year ? chunk.frames.find(f=>f.t===month)??null : null;
  return {manifest:store?.manifest??null,frame,error};
}
