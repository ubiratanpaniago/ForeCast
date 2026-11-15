import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthlyFrameStore, monthlyAnomaly, parseMonthlyManifest, parseMonthlyYear, type MonthlyManifest } from "./monthlyApi";

// Contract-only synthetic fixtures; production is backed by verified NASA frames.
function manifest():MonthlyManifest {
  return {schemaVersion:1,gridId:"imerg-monthly-v07",revision:"test",unit:"mm",resolutionDegrees:.1,
    months:Array.from({length:288},(_,i)=>`${2001+Math.floor(i/12)}-${String(i%12+1).padStart(2,"0")}`),
    grid:{lat:[-33.95],lon:[-57.95,-57.85],res:.1},cells:[{id:"imerg-monthly-v07:r560:c1220",index:0},{id:"imerg-monthly-v07:r560:c1221",index:1}],
    referencePeriod:{start:2001,end:2024},requiredReferenceYears:24,
    climatology:Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1).padStart(2,"0"),[10,0]])),
    referenceCounts:Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1).padStart(2,"0"),[24,24]])),
    metadata:{productId:"GPM_3IMERGM_07",version:"07B",sourceDOI:"10.test/science",demonstrative:false,qualityNotes:[]}};
}
function year(m=manifest(),y=2001) {
  return {gridId:m.gridId,revision:m.revision,unit:"mm" as const,year:y,
    frames:Array.from({length:12},(_,i)=>({t:`${y}-${String(i+1).padStart(2,"0")}`,values:[0,null]}))};
}
afterEach(()=>vi.unstubAllGlobals());
describe("Contrato mensal",()=>{
  it("preserva zero real e lacuna, sem inventar valores",()=>{
    const m=manifest();expect(parseMonthlyManifest(m)).toBe(m);
    expect(parseMonthlyYear(year(m),m,2001).frames[0].values).toEqual([0,null]);
    expect(monthlyAnomaly(0,10)).toBe(-100);
    expect(monthlyAnomaly(0,0)).toBeNull();expect(monthlyAnomaly(10,null)).toBeNull();
    expect(monthlyAnomaly(null,10)).toBeNull();expect(monthlyAnomaly(15,10)).toBe(50);
  });
  it.each(["stale","wrongYear","negative","missingFrame"])("rejeita quadros %s",kind=>{
    const m=manifest(),y=year(m);
    if(kind==="stale")y.revision="old";
    if(kind==="wrongYear")y.frames[0].t="2002-01";
    if(kind==="negative")y.frames[0].values[0]=-1;
    if(kind==="missingFrame")y.frames.pop();
    expect(()=>parseMonthlyYear(y,m,2001)).toThrow();
  });
  it("rejeita referência publicada com cobertura insuficiente",()=>{
    const m=manifest();m.referenceCounts["01"][0]=23;
    expect(()=>parseMonthlyManifest(m)).toThrow();m.climatology["01"][0]=null as unknown as number;
    expect(parseMonthlyManifest(m)).toBe(m);
  });
  it("compartilha a requisição e reaproveita os 12 quadros durante o play",async()=>{
    const m=manifest();const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(year(m)),{status:200}));
    vi.stubGlobal("fetch",fetcher);const store=new MonthlyFrameStore(m);
    const [a,b]=await Promise.all([store.load(2001),store.load(2001)]);
    expect(a).toBe(b);expect(await store.load(2001)).toBe(a);expect(fetcher).toHaveBeenCalledTimes(1);store.dispose();
  });
});
