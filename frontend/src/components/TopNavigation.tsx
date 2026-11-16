import "./top-navigation.css";
import { useLanguage } from "../i18n/LanguageContext";

type Page = "home" | "support" | "analysis" | "dossier";

export function TopNavigation({ page, title, subtitle }: {
  page: Page;
  title: string;
  subtitle?: string;
}) {
  const { t, language, setLanguage } = useLanguage();
  return (
    <header className="site-header">
      <a className="site-brand" href="/" aria-label="ForeCast, página principal">
        <span>ForeCast<span className="site-brand-dot">.</span></span>
        <small>{t("Chuva, história e cuidado.")}</small>
      </a>
      <div className="site-heading">
        <h1>{t(title)}</h1>
        {subtitle && <p>{t(subtitle)}</p>}
      </div>
      <nav className="site-nav" aria-label={t("Menu principal")}>
        <a className="site-nav-outline" href="/" aria-current={page === "home" ? "page" : undefined}>{t("Início")}</a>
        <a className="site-nav-outline" href="/analise" aria-current={page === "analysis" ? "page" : undefined}>{t("Estradas")}</a>
        <a className="site-nav-outline" href="/entenda" aria-current={page === "dossier" ? "page" : undefined}>{t("Detalhes")}</a>
        <a className="site-nav-primary" href="/apoio" aria-current={page === "support" ? "page" : undefined}>{t("Apoio")}</a>
        <div className="site-language" role="group" aria-label={t("Idioma")}>
          <button type="button" aria-pressed={language === "pt"} onClick={() => setLanguage("pt")}>
            PT
          </button>
          <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
            EN
          </button>
        </div>
      </nav>
    </header>
  );
}
