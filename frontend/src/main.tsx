import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
if (window.location.pathname.startsWith("/grids")) {
  void import("./styles.css");
} else {
  void import("./features/dossier/styles/global.css");
}
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
