import { lazy, Suspense, useEffect } from "react";
import { useLanguage } from "./i18n/LanguageContext";
const Dossier = lazy(() => import("./features/dossier/Dossier"));
const NativeGridExplorer = lazy(() => import("./NativeGridExplorer"));
const RegionalExplorer = lazy(() => import("./features/regional/RegionalExplorer"));
const AnalysisPage = lazy(() => import("./features/analysis/AnalysisPage"));
const SupportPage = lazy(() => import("./features/support/SupportPage"));
const SimpleHome = lazy(() => import("./features/simple-home/SimpleHome"));
export default function App() {
  const { t, language } = useLanguage();
  useEffect(() => {
    const path = window.location.pathname;
    const pageTitle = path.startsWith("/grids")
      ? "Exploração das grades"
      : path.startsWith("/regioes")
        ? "Investigação regional"
        : path.startsWith("/analise")
          ? "Chuva e estradas"
          : path.startsWith("/apoio")
            ? "Como encontrar apoio na sua região"
            : path.startsWith("/entenda")
              ? "Dossiê exploratório"
              : "As chuvas na sua região";
    document.documentElement.lang = language === "en" ? "en" : "pt-BR";
    document.title = `ForeCast · ${t(pageTitle)}`;
  }, [language, t]);
  return (
    <Suspense fallback={<p>{t("Carregando explorador…")}</p>}>
      {window.location.pathname.startsWith("/grids") ? (
        <NativeGridExplorer />
      ) : window.location.pathname.startsWith("/regioes") ? (
        <RegionalExplorer />
      ) : window.location.pathname.startsWith("/analise") ? (
        <AnalysisPage />
      ) : window.location.pathname.startsWith("/apoio") ? (
        <SupportPage />
      ) : window.location.pathname.startsWith("/entenda") ? (
        <Dossier />
      ) : (
        <SimpleHome />
      )}
    </Suspense>
  );
}
