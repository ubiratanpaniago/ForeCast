// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// Only test fixtures; the application obtains production values from the existing API.
vi.mock("../dossier/hooks/useMonthlyRainfall", () => ({ useMonthlyRainfall: () => ({
  manifest: { months: ["2024-10","2024-11","2024-12"], revision: "test", grid: { lon: [-52.45,-52.35], lat: [-28.05], res:.1 },
    cells: [{id:"imerg-monthly-v07:r619:c1275",index:0},{id:"test-point-2",index:1}], climatology: {"12":[50,100]} },
  frame: {t:"2024-12", values:[100,200]}, error: "",
}) }));
vi.mock("../dossier/components/MonthlyRainMap", () => ({ MonthlyRainMap: ({onSelect}:{onSelect:(i:number)=>void}) => <button onClick={()=>onSelect(1)}>Escolher ponto de teste</button> }));
vi.mock("./HomeHistory", () => ({ HomeHistory: () => <section>Gráfico do histórico</section> }));
vi.mock("../../services/regionApi", () => ({ getRegionGeometry: async () => ({type:"FeatureCollection",features:[]}) }));
import SimpleHome from "./SimpleHome";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root, container:HTMLDivElement;
beforeEach(async()=>{
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event("close"));}});
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<SimpleHome/>));
});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const button=(text:string)=>Array.from(container.querySelectorAll("button")).find(b=>b.textContent?.includes(text))!;
it("mostra dados históricos, sem criar previsão ou dados até 2031",()=>{
  expect(container.textContent).toContain("Dezembro de 2024");
  expect(container.textContent).toContain("ainda não disponível");
  expect(container.textContent).not.toContain("2031");
  expect(container.querySelector('.home-understand')?.getAttribute('href')).toBe('/entenda');
  expect(container.querySelector('.home-play')).toBeNull();
  expect(container.querySelector('input[type="range"]')).toBeNull();
  expect(container.querySelector('select')).toBeNull();
  expect(container.textContent).toContain('Gráfico do histórico');
  expect(container.textContent).toContain('Localização de exemplo');
  expect(container.textContent).toContain('28,05° S');
  expect(container.textContent).toContain('52,45° O');
});
it("inicia no exemplo real, troca o ponto e permite voltar ao exemplo",()=>{
  expect(container.querySelector('.home-rain-row strong')?.textContent).toBe('100 mm');
  act(()=>button('Escolher ponto de teste').click());
  expect(container.querySelector('.home-rain-row strong')?.textContent).toBe('200 mm');
  expect(container.textContent).toContain('Dados do ponto aproximado');
  act(()=>button('Voltar ao exemplo').click());
  expect(container.querySelector('.home-rain-row strong')?.textContent).toBe('100 mm');
});
it("abre a tela de apoio pelo link principal",()=>{
  expect(container.querySelector('.site-nav-primary')?.getAttribute('href')).toBe('/apoio');
});
