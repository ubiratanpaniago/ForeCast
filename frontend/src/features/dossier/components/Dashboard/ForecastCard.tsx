import { useLanguage } from "../../../../i18n/LanguageContext";

export default function ForecastCard() {
  const { t } = useLanguage();
  return (
    <div className="pending">
      <span className="stamp">{t("Pendente")}</span>
      <p>
        {t("RX1DAY e dias com chuva ≥50 mm dependem dos indicadores históricos calculados a partir do IMERG diário.")}
      </p>
      <p>{t("Nenhum extremo diário é estimado a partir dos acumulados mensais.")}</p>
    </div>
  );
}
