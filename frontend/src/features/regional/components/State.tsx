import type { ReactNode } from "react";
import type { Loadable } from "../../../hooks/useRegionalTrends";
import { useLanguage } from "../../../i18n/LanguageContext";

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
  const { t } = useLanguage();
  if (state.status === "ready") return <>{children(state.data)}</>;
  if (state.status === "idle") return null;
  if (state.status === "loading")
    return (
      <p className={`rg-state ${compact ? "is-compact" : ""}`} aria-busy="true">
        <span className="rg-spinner" aria-hidden /> {t("Carregando")} {t(what)}…
      </p>
    );
  return (
    <div className={`rg-state rg-state--error ${compact ? "is-compact" : ""}`} role="status">
      <strong>{t("Não foi possível carregar")} {t(what)}.</strong> {t(state.message)}
      {HINT[state.code] && <span className="muted"> {t(HINT[state.code])}</span>}
    </div>
  );
}
