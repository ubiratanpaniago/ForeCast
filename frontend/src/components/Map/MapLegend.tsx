import type { IndicatorId, LayerId } from "../../types/geography";
import { indicators } from "./MapLayers";
export function MapLegend({
  layer,
  indicator,
}: {
  layer: LayerId;
  indicator: IndicatorId;
}) {
  const item = indicators[indicator];
  return (
    <section className="legend" aria-label="Legenda de magnitude e evidência">
      <div className="eyebrow">
        {layer === "neutral"
          ? "LIMITES GEOGRÁFICOS"
          : `MAGNITUDE / ${item.unit} por década`}
      </div>
      {layer === "trend" ? (
        <>
          <div className="color-scale historical" />
          <div className="scale-labels">
            <span>≤ −{item.extent}</span>
            <span>0</span>
            <span>≥ +{item.extent}</span>
          </div>
          <p className="legend-explanation">
            Cor = inclinação de Sen. Zero não significa inconclusivo.
          </p>
          <div className="evidence-key">
            <span>
              <i className="solid-evidence" />
              Evidência significativa*
            </span>
            <span>
              <i className="dashed-evidence" />
              Inconclusivo / exploratório
            </span>
          </div>
          <p className="legend-explanation">
            * status válido, p ≤ 0,05 e IC95% exclui zero. Traço não representa
            magnitude.
          </p>
        </>
      ) : (
        <p>Limites estaduais, sem indicador climático.</p>
      )}
      <div className="no-data">
        <i />
        {layer === "neutral"
          ? "Território sem indicador"
          : "Cinza escuro: sem dados / insuficiente"}
      </div>
    </section>
  );
}
