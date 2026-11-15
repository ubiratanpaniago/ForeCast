import { expect, it } from 'vitest';
import { distanceKm,phoneHref } from './supportData';
it('calcula distância em linha reta e valida telefones',()=>{
 const origin={name:'Exemplo',lat:-28.05,lon:-52.45};
 expect(distanceKm(origin,origin)).toBe(0);
 expect(distanceKm(origin,{lat:-28.15,lon:-52.45})).toBeCloseTo(11.119,2);
 expect(phoneHref('+55 (54) 1234-5678')).toBe('tel:+555412345678');
 expect(phoneHref('javascript:alert(1)')).toBeNull();
});
