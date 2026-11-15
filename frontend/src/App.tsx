import { lazy, Suspense } from "react";
const Dossier = lazy(() => import("./features/dossier/Dossier"));
const NativeGridExplorer = lazy(() => import("./NativeGridExplorer"));
export default function App() {
  return (
    <Suspense fallback={<p>Carregando explorador…</p>}>
      {window.location.pathname.startsWith("/grids") ? (
        <NativeGridExplorer />
      ) : (
        <Dossier />
      )}
    </Suspense>
  );
}
