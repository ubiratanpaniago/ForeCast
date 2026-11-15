// Frontend display model. The producer-specific adapter is pending the actual
// calculated-point source; no backend URL or upstream schema is assumed.
export type Place = {name:string;lat:number;lon:number};
export type SupportPoint = {
  id:string;name:string;lat:number;lon:number;address:string;
  phone:string|null;hours:string|null;wheelchair:string|null;checked:string|null;
  criteria?:Array<{label:string;value:string}>;
  source?:string;calculatedAt?:string;
};
export function distanceKm(a: Place, b: {lat:number;lon:number}) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function phoneHref(phone: string | null) {
  if (!phone) return null;
  const first = phone.split(/[;,]/)[0].replace(/[^\d+]/g,'');
  return /^\+?\d{8,15}$/.test(first) ? `tel:${first}` : null;
}
