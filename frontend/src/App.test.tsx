import { expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
// Isola WebGL: este teste verifica o primeiro render, antes de qualquer fetch.
vi.mock("./components/Map/ClimateMap", () => ({
  ClimateMap: () => <div>Mapa</div>,
}));
import App from "./App";
it("renderiza enquanto catálogo, grade e seleção ainda estão ausentes", () => {
  const html = renderToString(<App />);
  expect(html).toContain("Carregando catálogo");
  expect(html).toContain("AGUARDANDO DADOS REAIS");
});
