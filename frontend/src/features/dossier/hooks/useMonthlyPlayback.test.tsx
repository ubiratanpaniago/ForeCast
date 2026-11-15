// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMonthlyPlayback } from "./useMonthlyPlayback";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const months=["2001-11","2001-12","2002-01"];
let root:Root,container:HTMLDivElement;
function Harness({ready=true}:{ready?:boolean}) {
  const [month,setMonth]=useState("2001-11"),p=useMonthlyPlayback(months,month,ready,setMonth);
  return <><output>{month}</output><button onClick={p.toggle}>play</button><button onClick={()=>p.select("2001-12")}>select</button>
    <button onClick={()=>p.setLoop(false)}>no loop</button><button onClick={()=>p.setSpeed(2)}>fast</button><span>{String(p.playing)}</span></>;
}
beforeEach(()=>{vi.useFakeTimers();container=document.createElement("div");document.body.append(container);root=createRoot(container);act(()=>root.render(<Harness/>));});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.useRealTimers();});
const click=(i:number)=>act(()=>container.querySelectorAll("button")[i].click());
const tick=(ms=1000)=>act(()=>vi.advanceTimersByTime(ms));
const current=()=>container.querySelector("output")!.textContent;
it("avança dezembro → janeiro e repete sem saltar datas",()=>{
  click(0);tick();expect(current()).toBe("2001-12");tick();expect(current()).toBe("2002-01");tick();expect(current()).toBe("2001-11");
});
it("espera os dados do próximo bloco antes de avançar",()=>{
  click(0);tick();act(()=>root.render(<Harness ready={false}/>));tick(5000);expect(current()).toBe("2001-12");
  act(()=>root.render(<Harness ready/>));tick();expect(current()).toBe("2002-01");
});
it("seleção manual pausa a reprodução",()=>{click(0);click(1);tick(5000);expect(current()).toBe("2001-12");expect(container.querySelector("span")!.textContent).toBe("false");});
it("respeita 2× e para no último mês sem repetição",()=>{click(2);click(3);click(0);tick(500);expect(current()).toBe("2001-12");tick(500);expect(current()).toBe("2002-01");tick(500);expect(container.querySelector("span")!.textContent).toBe("false");});
