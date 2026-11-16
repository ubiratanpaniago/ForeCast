import { layerNames } from "./MapLayers";
import type { LayerId } from "../../types/geography";
import { useLanguage } from "../../i18n/LanguageContext";
export function LayerSelector({
  value,
  onChange,
}: {
  value: LayerId;
  onChange: (layer: LayerId) => void;
}) {
  const { t } = useLanguage();
  return (
    <fieldset className="layer-selector">
      <legend className="eyebrow">{t("01 / CAMADA DE ANÁLISE")}</legend>
      {(Object.keys(layerNames) as LayerId[]).map((layer, i) => (
        <label
          key={layer}
          className={value === layer ? "layer-option active" : "layer-option"}
        >
          <input
            type="radio"
            name="layer"
            value={layer}
            checked={value === layer}
            onChange={() => onChange(layer)}
          />
          <span className="layer-index">0{i + 1}</span>
          <span>{t(layerNames[layer])}</span>
          <span className="radio-mark" />
        </label>
      ))}
    </fieldset>
  );
}
