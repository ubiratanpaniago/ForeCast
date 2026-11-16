import { afterEach, expect, it, vi } from "vitest";
import { apiFetch } from "./apiFetch";

const html = (status: number) => new Response("<html>reiniciando</html>", { status, headers: { "content-type": "text/html" } });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

it("tenta de novo após falha de rede e 502 do provedor", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(html(502))
    .mockResolvedValueOnce(json(200, { ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  const res = await apiFetch("http://api.test/x", { timeoutMs: 1000, retryDelaysMs: [0, 0, 0] });
  expect(res.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("não repete erro definitivo da própria API (corpo JSON)", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(503, { error: { code: "DATA_INVALID", message: "x" } }));
  vi.stubGlobal("fetch", fetchMock);
  const res = await apiFetch("http://api.test/x", { timeoutMs: 1000, retryDelaysMs: [0, 0] });
  expect(res.status).toBe(503);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("devolve a última resposta quando as tentativas acabam", async () => {
  const fetchMock = vi.fn().mockResolvedValue(html(503));
  vi.stubGlobal("fetch", fetchMock);
  const res = await apiFetch("http://api.test/x", { timeoutMs: 1000, retryDelaysMs: [0, 0] });
  expect(res.status).toBe(503);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("não repete quando a tela cancela a requisição", async () => {
  const controller = new AbortController();
  const fetchMock = vi.fn().mockImplementation(async () => {
    controller.abort();
    throw new DOMException("cancelado", "AbortError");
  });
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    apiFetch("http://api.test/x", { signal: controller.signal, timeoutMs: 1000, retryDelaysMs: [0, 0] }),
  ).rejects.toThrow("cancelado");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
