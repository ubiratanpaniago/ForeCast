// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
vi.mock('./SupportMap',()=>({SupportMap:()=> <div>Mapa de teste</div>}));
vi.mock('./supportData',async importOriginal=>{
  const original=await importOriginal<typeof import('./supportData')>();
  return {...original,findPoints:vi.fn().mockResolvedValue([
    {id:'node/1',name:'Instituição de teste',lat:-28.26,lon:-52.4,kind:'health',address:'Endereço de teste',phone:null,hours:null,wheelchair:null,distance:1,checked:null},
    {id:'node/2',name:'Acolhimento de teste',lat:-28.26,lon:-52.4,kind:'shelter',address:'Endereço de teste',phone:null,hours:null,wheelchair:null,distance:2,checked:null},
  ])};
});
import SupportPage from './SupportPage';
import { findPoints } from './supportData';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,container:HTMLDivElement;
beforeEach(async()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<SupportPage/>));
});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.clearAllMocks();});
function click(text:string){const button=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!;act(()=>button.click());}
it('distingue cadastro, funcionamento e avaliação de segurança',()=>{
  expect(container.textContent).toContain('Funcionamento não confirmado');
  expect(container.textContent).toContain('Telefone não informado');
  click('Por que aparece?');
  expect(container.textContent).toContain('não foram usados para classificar este ponto como seguro');
  expect(container.querySelector('a[href="https://www.openstreetmap.org/node/1"]')).not.toBeNull();
  click('Como chegar');
  expect(container.textContent).toContain('Sem informação em tempo real');
  expect(container.textContent).toContain('linha reta');
});
it('filtra acolhimento sem manter um local de saúde selecionado',()=>{
  const select=container.querySelector('#support-kind') as HTMLSelectElement;
  act(()=>{select.value='shelter';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.querySelector('.support-tab-content h3')?.textContent).toBe('Acolhimento de teste');
  expect(container.querySelectorAll('.support-result')).toHaveLength(1);
});
it('separa como apoiar da procura por ajuda e restaura o foco',()=>{
  const button=container.querySelector('.support-contribute') as HTMLButtonElement;button.focus();click('Como apoiar');
  expect(container.querySelector('dialog')?.open).toBe(true);
  click('Ser voluntário');expect(container.textContent).toContain('Aguarde a orientação');
  click('Voltar aos locais');expect(container.querySelector('dialog')?.open).toBe(false);
  expect(document.activeElement).toBe(button);
});
it('oferece recuperação após falha da busca',async()=>{
  vi.mocked(findPoints).mockRejectedValueOnce(new Error('Fonte indisponível'));
  const select=container.querySelector('#support-city') as HTMLSelectElement;
  await act(async()=>{select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.textContent).toContain('Não conseguimos buscar agora');
  await act(async()=>click('Tentar novamente'));
  expect(container.textContent).toContain('Instituição de teste');
});
