// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
vi.mock('./SupportMap',()=>({SupportMap:()=> <div>Mapa do Sul</div>}));
vi.mock('../dossier/hooks/useMonthlyRainfall',()=>({useMonthlyRainfall:()=>({manifest:null,frame:null,error:''})}));
vi.mock('../../services/regionApi',()=>({getRegionGeometry:async()=>({type:'FeatureCollection',features:[]})}));
import SupportPage from './SupportPage';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,container:HTMLDivElement;
beforeEach(async()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(<SupportPage/>));
});
afterEach(()=>{act(()=>root.unmount());container.remove();});
function button(text:string){return Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!;}
it('mantém os três blocos da referência e não substitui pontos do sistema por cadastros OSM',()=>{
 expect(container.textContent).toContain('Local mais próximo');
 expect(container.textContent).toContain('Sua região');
 expect(container.textContent).toContain('Pontos de apoio indisponíveis');
 expect(container.querySelector('a[href*="google.com/maps/dir"]')).toBeNull();
 expect(container.textContent).not.toContain('OpenStreetMap');
 expect(button('Por que este ponto').disabled).toBe(true);
});
it('mostra critérios fornecidos pelo produtor sem inventar avaliação',async()=>{
 await act(async()=>root.render(<SupportPage calculatedPoints={[{id:'fixture-only',name:'Ponto de teste',lat:-28.05,lon:-52.45,address:'Endereço de teste',phone:null,hours:null,wheelchair:null,checked:null,criteria:[{label:'Critério do produtor',value:'Resultado recebido'}],source:'Fonte de teste'}]}/>));
 expect(container.textContent).toContain('Ponto de teste');
 expect(container.textContent).toContain('0 km em linha reta');
 act(()=>button('Por que este ponto').click());
 expect(container.querySelectorAll('dialog')[1].open).toBe(true);
 expect(container.textContent).toContain('Resultado recebido');
 expect(container.textContent).toContain('Fonte de teste');
});
it('mantém Como apoiar separado e permite fechar com retorno de foco',()=>{
 const trigger=button('Como apoiar');trigger.focus();act(()=>trigger.click());
 expect(container.querySelector('dialog')?.open).toBe(true);
 act(()=>button('Ser voluntário').click());expect(container.textContent).toContain('Aguarde a orientação');
 act(()=>button('Voltar ao mapa').click());
 expect(document.activeElement).toBe(trigger);expect(container.querySelector('dialog')?.open).toBe(false);
});
