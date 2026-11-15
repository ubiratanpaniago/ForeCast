import type { ReactNode } from "react";
import type { Loadable } from "../../../hooks/useRegionalTrends";

const HINT: Record<string, string> = {
  NETWORK: "Inicie a API em backend/ (uvicorn app.main:app --port 8000).",
  GRID_DATA_UNAVAILABLE: "Os arquivos derivados não estão publicados no backend.",
};

/** Estados padronizados: carregando, erro (com código da API) e conteúdo. */
export function State<T>({
  state,
  what,
  children,
  compact,
}: {
  state: Loadable<T>;
  what: string;
  children: (data: T) => ReactNode;
  compact?: boolean;
}) {
  if (state.status === "ready") return <>{children(state.data)}</>;
  if (state.status === "idle") return null;
  if (state.status === "loading")
    return (
      <p className={`rg-state ${compact ? "is-compact" : ""}`} aria-busy="true">
        <span className="rg-spinner" aria-hidden /> Carregando {what}…
      </p>
    );
  return (
    <div className={`rg-state rg-state--error ${compact ? "is-compact" : ""}`} role="status">
      <strong>Não foi possível carregar {what}.</strong> {state.message}
      {HINT[state.code] && <span className="muted"> {HINT[state.code]}</span>}
    </div>
  );
}
