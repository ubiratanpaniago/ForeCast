import { expect, it, vi, afterEach } from 'vitest';
import { CITIES, parsePoints, distanceKm, phoneHref, findPoints } from './supportData';
afterEach(()=>vi.unstubAllGlobals());
const origin=CITIES[0];
it('aceita locais reais com coordenadas válidas, ordena por distância e não atribui confirmação',()=>{
  const result=parsePoints({elements:[
    {type:'way',id:2,center:{lat:-28.27,lon:-52.41},tags:{name:'Instituição A',amenity:'hospital'}},
    {type:'node',id:1,lat:origin.lat,lon:origin.lon,tags:{name:'Instituição B',amenity:'social_facility',social_facility:'shelter'}},
    {type:'node',id:3,lat:0,lon:0,tags:{name:'Fora do recorte',amenity:'hospital'}},
    {type:'node',id:4,tags:{name:'Sem coordenadas',amenity:'hospital'}},
    {type:'node',id:5,lat:origin.lat,lon:origin.lon,tags:{name:'Escola',amenity:'school'}},
  ]},origin);
  expect(result.map(p=>p.id)).toEqual(['node/1','way/2']);
  expect(result[0].hours).toBeNull();expect(result[0].address).toContain('não informado');
  expect(result[0]).not.toHaveProperty('confirmed');
});
it('rejeita consultas parciais e contratos inválidos em vez de apresentar busca vazia',()=>{
  expect(()=>parsePoints({elements:[],remark:'timeout'},origin)).toThrow();
  expect(()=>parsePoints({},origin)).toThrow();
});
it('calcula distância em linha reta e aceita apenas telefones discáveis',()=>{
  expect(distanceKm(origin,origin)).toBe(0);
  expect(phoneHref('+55 (54) 1234-5678; 9999')).toBe('tel:+555412345678');
  expect(phoneHref('javascript:alert(1)')).toBeNull();
  expect(phoneHref(null)).toBeNull();
});
it('trata falhas da fonte externa sem criar locais substitutos',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
  await expect(findPoints(origin,new AbortController().signal)).rejects.toThrow('indisponível');
});
