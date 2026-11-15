import { useCallback, useEffect, useState } from "react";

export function useMonthlyPlayback(months: string[], month: string, ready: boolean, onChange: (t:string)=>void) {
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [loop,setLoop]=useState(true);
  const select=useCallback((t:string)=>{setPlaying(false);onChange(t);},[onChange]);
  const pause=useCallback(()=>setPlaying(false),[]);
  const toggle=()=>{
    if(playing) {setPlaying(false);return;}
    if(!ready || months.length<2) return;
    if(month===months[months.length-1]) onChange(months[0]);
    setPlaying(true);
  };
  useEffect(()=>{
    if(!playing||!ready) return;
    const timer=window.setTimeout(()=>{
      const i=months.indexOf(month);
      if(i<months.length-1) onChange(months[i+1]);
      else if(loop) onChange(months[0]);
      else setPlaying(false);
    },1000/speed);
    return ()=>window.clearTimeout(timer);
  },[months,month,ready,playing,speed,loop,onChange]);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener("visibilitychange",hidden);
    return ()=>document.removeEventListener("visibilitychange",hidden);
  },[]);
  return {playing,speed,setSpeed,loop,setLoop,select,pause,toggle};
}
