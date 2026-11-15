import { afterEach, expect, it, vi } from "vitest";
import snapshot from "../../../../public/data/snapshot.json";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("consulta o FastAPI por padrão e preserva o contrato", async () => {
  vi.stubEnv("VITE_SNAPSHOT_MODE", "api");
  vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000");
  const request = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(snapshot)));
  vi.stubGlobal("fetch", request);
  const { fetchSnapshot } = await import("./api");
  const result = await fetchSnapshot();
  expect(request.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/snapshot");
  expect(result.annual).toEqual(snapshot.annual);
});
it("modo static precisa ser escolhido explicitamente", async () => {
  vi.stubEnv("VITE_SNAPSHOT_MODE", "static");
  const request = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(snapshot)));
  vi.stubGlobal("fetch", request);
  const { fetchSnapshot } = await import("./api");
  await fetchSnapshot();
  expect(request.mock.calls[0][0]).toBe("/data/snapshot.json");
});
it("mostra o erro da API sem fallback para arquivo local", async () => {
  vi.stubEnv("VITE_SNAPSHOT_MODE", "api");
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "DATA_INVALID", message: "Arquivo inválido." },
        }),
        { status: 503 },
      ),
    );
  vi.stubGlobal("fetch", request);
  const { fetchSnapshot } = await import("./api");
  await expect(fetchSnapshot()).rejects.toThrow("Arquivo inválido.");
  expect(request).toHaveBeenCalledTimes(1);
});
it("propaga falha de conexão para a tela de erro", async () => {
  vi.stubEnv("VITE_SNAPSHOT_MODE", "api");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  const { fetchSnapshot } = await import("./api");
  await expect(fetchSnapshot()).rejects.toThrow("Failed to fetch");
});
