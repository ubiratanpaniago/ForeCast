import { useLanguage } from "../../../../i18n/LanguageContext";

export default function ProjectionChart() {
  const { t } = useLanguage();
  return (
    <div className="pending">
      <span className="stamp">{t("Pendente")}</span>
      <p>
        {t("Mann-Kendall, inclinação de Sen e intervalos de confiança aguardam resultados da equipe científica.")}
      </p>
      <p>
        {t("As anomalias exibidas nesta página não são testes de significância nem projeções futuras.")}
      </p>
    </div>
  );
}
