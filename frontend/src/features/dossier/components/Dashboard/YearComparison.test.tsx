// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import snapshot from "../../../../../public/data/snapshot.json";
import { YearComparison } from "./YearComparison";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function Harness() {
  const [year, setYear] = useState(2024);
  return (
    <YearComparison
      data={snapshot}
      year={year}
      onSelectYear={setYear}
      block={[2, 3]}
    />
  );
}
it("troca anos sem duplicar seleção e permite comparação do bloco fixado", () => {
  act(() => root.render(<Harness />));
  const selects = container.querySelectorAll("select");
  act(() => {
    selects[0].value = "2020";
    selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    selects[1].value = "2020";
    selects[1].dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.textContent).toContain("O mesmo ano");
  expect(container.querySelector("svg")).not.toBeNull();
  act(() => {
    selects[2].value = "block";
    selects[2].dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.querySelector("svg")).toBeNull();
  expect(container.textContent).toContain("somente totais anuais por bloco");
});
it("não oferece comparação espacial sem um bloco selecionado", () => {
  act(() =>
    root.render(
      <YearComparison
        data={snapshot}
        year={2024}
        onSelectYear={() => {}}
        block={null}
      />,
    ),
  );
  expect(
    container.querySelector<HTMLOptionElement>("option[value=block]")!.disabled,
  ).toBe(true);
});
