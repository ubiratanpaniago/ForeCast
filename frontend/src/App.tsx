import { lazy, Suspense } from "react";
const Dossier = lazy(() => import("./features/dossier/Dossier"));
const NativeGridExplorer = lazy(() => import("./NativeGridExplorer"));
const RegionalExplorer = lazy(() => import("./features/regional/RegionalExplorer"));
const SupportPage = lazy(() => import("./features/support/SupportPage"));
const SimpleHome = lazy(() => import("./features/simple-home/SimpleHome"));
export default function App() {
  return (
    <Suspense fallback={<p>Carregando explorador…</p>}>
      {window.location.pathname.startsWith("/grids") ? (
        <NativeGridExplorer />
      ) : window.location.pathname.startsWith("/regioes") ? (
        <RegionalExplorer />
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
