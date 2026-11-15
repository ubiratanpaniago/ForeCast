import "./top-navigation.css";

type Page = "home" | "support" | "analysis" | "dossier";

export function TopNavigation({ page, title, subtitle }: {
  page: Page;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="site-header">
      <a className="site-brand" href="/" aria-label="ForeCast, página principal">
        <span>ForeCast<span className="site-brand-dot">.</span></span>
        <small>Chuva, história e cuidado.</small>
      </a>
      <div className="site-heading">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <nav className="site-nav" aria-label="Menu principal">
        <a className="site-nav-outline" href="/" aria-current={page === "home" ? "page" : undefined}>Início</a>
        <a className="site-nav-outline" href="/analise" aria-current={page === "analysis" ? "page" : undefined}>Estradas</a>
        <a className="site-nav-outline" href="/entenda" aria-current={page === "dossier" ? "page" : undefined}>Detalhes</a>
        <a className="site-nav-primary" href="/apoio" aria-current={page === "support" ? "page" : undefined}>Apoio</a>
      </nav>
    </header>
  );
}
