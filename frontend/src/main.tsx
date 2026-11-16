import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import { LanguageProvider } from "./i18n/LanguageContext";
if (window.location.pathname.startsWith("/grids")) {
  void import("./styles.css");
} else {
  void import("./features/dossier/styles/global.css");
  if (window.location.pathname.startsWith("/regioes")) void import("./features/regional/regional.css");
  if (window.location.pathname.startsWith("/analise")) void import("./features/regional/regional.css");
}
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
