// fetch com novas tentativas para quando a API hospedada está reiniciando.
//
// Em produção, a API pode levar alguns segundos para responder após um deploy
// ou reinício do serviço: nesse intervalo, a conexão falha, o tempo esgota ou o
// proxy do provedor devolve 502/503/504 em HTML. Em vez de mostrar erro na
// primeira falha, tentamos de novo e a tela continua em "Carregando…".
//
// Erros da própria API (corpo JSON, como DATA_INVALID) não são repetidos: são
// respostas definitivas e devem aparecer ao usuário sem atraso.
// Fora do build de produção não há novas tentativas (desenvolvimento e testes
// recebem a falha imediatamente).

export const PRODUCTION_RETRY_DELAYS_MS = [2000, 5000, 10000, 15000];
const RETRY_STATUS = new Set([502, 503, 504]);

export interface ApiFetchOptions {
  signal?: AbortSignal;
  /** Tempo máximo de cada tentativa. */
  timeoutMs: number;
  /** Espera antes de cada nova tentativa; vazio desativa as repetições. */
  retryDelaysMs?: readonly number[];
}

const defaultDelays = () => (import.meta.env.PROD ? PRODUCTION_RETRY_DELAYS_MS : []);

const isRetryableResponse = (res: Response) =>
  RETRY_STATUS.has(res.status) && !(res.headers.get("content-type") ?? "").includes("application/json");

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function apiFetch(url: string, options: ApiFetchOptions): Promise<Response> {
  const { signal, timeoutMs } = options;
  const delays = options.retryDelaysMs ?? defaultDelays();
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const isLast = attempt >= delays.length;
    try {
      const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (isLast || !isRetryableResponse(res)) return res;
    } catch (error) {
      // Cancelamento pedido pela tela (troca de seleção, desmontagem) não é repetido.
      if (signal?.aborted || isLast) throw error;
    }
    await wait(delays[attempt], signal);
  }
}
