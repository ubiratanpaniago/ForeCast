// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTemporalPlayback } from "./useTemporalPlayback";
import { TemporalPlayer } from "../components/TemporalPlayer";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
function Harness({ initial = 2003 }: { initial?: number }) {
  const [year, setYear] = useState(initial);
  const playback = useTemporalPlayback([2001, 2002, 2003], year, setYear);
  return (
    <TemporalPlayer
      years={[2001, 2002, 2003]}
      year={year}
      playback={playback}
    />
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  )!;
const year = () => container.querySelector("output")?.textContent;
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
describe("Reprodução temporal", () => {
  it("respeita a velocidade de 2 quadros por segundo", () => {
    act(() => button("Reproduzir").click());
    const select = container.querySelector("select")!;
    act(() => {
      select.value = "2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    tick(499);
    expect(year()).toBe("2001");
    tick(1);
    expect(year()).toBe("2002");
  });
  it("inicia no primeiro ano quando está no último e avança apenas com o relógio", () => {
    act(() => button("Reproduzir").click());
    expect(year()).toBe("2001");
    tick(999);
    expect(year()).toBe("2001");
    tick(1);
    expect(year()).toBe("2002");
  });
  it("pausa sem continuar alterando o ano", () => {
    act(() => button("Reproduzir").click());
    tick(1000);
    act(() => button("Pausar").click());
    tick(5000);
    expect(year()).toBe("2002");
  });
  it("repete ao terminar quando loop está ativo", () => {
    act(() => button("Reproduzir").click());
    tick(1000);
    tick(1000);
    expect(year()).toBe("2003");
    tick(1000);
    expect(year()).toBe("2001");
  });
  it("encerra no último ano com repetição desativada", () => {
    act(() =>
      container
        .querySelector<HTMLInputElement>("input[type=checkbox]")!
        .click(),
    );
    act(() => button("Reproduzir").click());
    tick(1000);
    tick(1000);
    tick(1000);
    expect(year()).toBe("2003");
    expect(button("Reproduzir")).toBeTruthy();
  });
  it("navegação manual interrompe a reprodução", () => {
    act(() => button("Reproduzir").click());
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Próximo ano"]')!
        .click(),
    );
    expect(year()).toBe("2002");
    tick(3000);
    expect(year()).toBe("2002");
  });
  it("pausa quando a página fica oculta", () => {
    act(() => button("Reproduzir").click());
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    tick(3000);
    expect(year()).toBe("2001");
    vi.restoreAllMocks();
  });
});
