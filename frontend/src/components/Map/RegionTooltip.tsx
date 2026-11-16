import { useLanguage } from "../../i18n/LanguageContext";

export function RegionTooltip({
  name,
  x,
  y,
}: {
  name: string;
  x: number;
  y: number;
}) {
  const { t } = useLanguage();
  return (
    <div className="region-tooltip" style={{ left: x + 12, top: y + 12 }}>
      {name}
      <small>{t("Clique para explorar")}</small>
    </div>
  );
}
