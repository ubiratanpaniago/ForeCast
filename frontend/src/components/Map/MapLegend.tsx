import type { IndicatorId, LayerId } from "../../types/geography";
import { indicators } from "./MapLayers";
import { useLanguage } from "../../i18n/LanguageContext";
export function MapLegend({
  layer,
  indicator,
}: {
  layer: LayerId;
  indicator: IndicatorId;
}) {
  const { t } = useLanguage();
  const item = indicators[indicator];
  const unit = t(item.unit);
  return (
    <section className="legend" aria-label={t("Legenda de magnitude e evidência")}>
      <div className="eyebrow">
        {layer === "neutral"
          ? t("LIMITES GEOGRÁFICOS")
          : t("MAGNITUDE / {unit} por década").replace("{unit}", unit)}
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
            {t("Cor = inclinação de Sen. Zero não significa inconclusivo.")}
          </p>
          <div className="evidence-key">
            <span>
              <i className="solid-evidence" />
              {t("Evidência significativa*")}
            </span>
            <span>
              <i className="dashed-evidence" />
              {t("Inconclusivo / exploratório")}
            </span>
          </div>
          <p className="legend-explanation">
            {t("* status válido, p ≤ 0,05 e IC95% exclui zero. Traço não representa magnitude.")}
          </p>
        </>
      ) : (
        <p>{t("Limites estaduais, sem indicador climático.")}</p>
      )}
      <div className="no-data">
        <i />
        {layer === "neutral"
          ? t("Território sem indicador")
          : t("Cinza escuro: sem dados / insuficiente")}
      </div>
    </section>
  );
}
