import { lazy, Suspense } from "react";
const Dossier = lazy(() => import("./features/dossier/Dossier"));
const NativeGridExplorer = lazy(() => import("./NativeGridExplorer"));
const RegionalExplorer = lazy(() => import("./features/regional/RegionalExplorer"));
export default function App() {
  return (
    <Suspense fallback={<p>Carregando explorador…</p>}>
      {window.location.pathname.startsWith("/grids") ? (
        <NativeGridExplorer />
      ) : window.location.pathname.startsWith("/regioes") ? (
        <RegionalExplorer />
      ) : (
        <Dossier />
      )}
    </Suspense>
  );
}
