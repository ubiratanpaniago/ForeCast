export const CITIES = [
  { name: 'Passo Fundo · RS', lat: -28.262, lon: -52.407 },
  { name: 'Porto Alegre · RS', lat: -30.0346, lon: -51.2177 },
  { name: 'Florianópolis · SC', lat: -27.5954, lon: -48.548 },
  { name: 'Curitiba · PR', lat: -25.4284, lon: -49.2733 },
];
export type Place = typeof CITIES[number];
export type SupportPoint = {
  id: string; name: string; lat: number; lon: number; kind: 'health' | 'shelter' | 'fire';
  address: string; phone: string | null; hours: string | null; wheelchair: string | null;
  distance: number; checked: string | null;
};
export const KIND_LABEL = { health: 'Atendimento de saúde', shelter: 'Acolhimento cadastrado', fire: 'Corpo de Bombeiros' };
export function distanceKm(a: Place, b: {lat:number;lon:number}) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function parsePoints(body: unknown, origin: Place): SupportPoint[] {
  const raw = body as {elements?: Array<{type?:string;id?:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>}>;remark?:string};
  if (!Array.isArray(raw?.elements) || raw.remark) throw new Error('A consulta de locais não foi concluída. Tente novamente.');
  return raw.elements.flatMap(e => {
    const p = e.center ?? e, t = e.tags;
    if (!t?.name || !['node','way','relation'].includes(e.type ?? '') || !Number.isFinite(e.id) || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return [];
    const lat = p.lat!, lon = p.lon!;
    if (lat < -34 || lat > -22 || lon < -58 || lon > -47) return [];
    const kind = t.amenity === 'fire_station' ? 'fire' : t.social_facility === 'shelter' ? 'shelter' : ['hospital','clinic'].includes(t.amenity) ? 'health' : null;
    if (!kind) return [];
    const distance = distanceKm(origin,{lat,lon});
    if (distance > 15.1) return [];
    return [{ id:`${e.type}/${e.id}`, name:t.name, lat, lon, kind,
      address:[t['addr:street'],t['addr:housenumber'],t['addr:suburb']].filter(Boolean).join(', ') || 'Endereço não informado no cadastro',
      phone: t.phone ?? t['contact:phone'] ?? null, hours:t.opening_hours ?? null,
      wheelchair:t.wheelchair ?? null, distance, checked:t.check_date ?? t['survey:date'] ?? null } satisfies SupportPoint];
  }).sort((a,b)=>a.distance-b.distance);
}
const searches = new Map<string, {at:number;promise:Promise<SupportPoint[]>}>();
export async function findPoints(origin: Place, signal: AbortSignal) {
  signal.throwIfAborted();
  const key=`${origin.lat},${origin.lon}`;
  const cached=searches.get(key);
  if(cached&&Date.now()-cached.at<15*60*1000){
    const result=await cached.promise;signal.throwIfAborted();return result;
  }
  const around = `around:15000,${origin.lat},${origin.lon}`;
  const query = `[out:json][timeout:20];(nwr[amenity~"^(hospital|clinic|fire_station)$"](${around});nwr[amenity=social_facility][social_facility=shelter](${around}););out center tags;`;
  // Share requests across React mounts. A stale view ignores the result; the shared
  // network request has its own timeout, avoiding duplicate public-service queries.
  const promise=(async()=>{
    let response: Response;
    try {
      response = await fetch(`https://overpass.private.coffee/api/interpreter?${new URLSearchParams({data:query})}`, {
        signal:AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error('A fonte de locais não respondeu a tempo. Verifique a conexão e tente novamente.');
    }
    if (!response.ok) throw new Error('A busca está indisponível agora. Tente novamente.');
    return parsePoints(await response.json(),origin);
  })();
  searches.set(key,{at:Date.now(),promise});
  promise.catch(()=>{if(searches.get(key)?.promise===promise)searches.delete(key);});
  const result=await promise;signal.throwIfAborted();return result;
}
export function phoneHref(phone: string | null) {
  if (!phone) return null;
  const first = phone.split(/[;,]/)[0].replace(/[^\d+]/g,'');
  return /^\+?\d{8,15}$/.test(first) ? `tel:${first}` : null;
}
