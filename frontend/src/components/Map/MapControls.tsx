import { useLanguage } from "../../i18n/LanguageContext";

export function MapControls({ onReset }: { onReset: () => void }) {
  const { t } = useLanguage();
  return (
    <button
      className="reset-button"
      onClick={onReset}
      title={t("Restaurar enquadramento do Sul do Brasil")}
    >
      <span aria-hidden="true">⌖</span> {t("Restaurar vista")}
    </button>
  );
}
