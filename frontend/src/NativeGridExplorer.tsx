import { useMemo, useState } from "react";
import { ClimateMap } from "./components/Map/ClimateMap";
import { LayerSelector } from "./components/Map/LayerSelector";
import { MapLegend } from "./components/Map/MapLegend";
import { GridCellPanel } from "./components/Map/GridCellPanel";
import { indicators } from "./components/Map/MapLayers";
import { useGridCatalog, useGridData } from "./hooks/useGridExplorer";
import { gridApiMode } from "./services/gridApi";
import type {
  LayerId,
  IndicatorId,
  RegionsGeoJSON,
  TrendResult,
} from "./types/geography";
import { useLanguage } from "./i18n/LanguageContext";
import "./grid-language.css";
export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const locale = language === "pt" ? "pt-BR" : "en-US";
  const [gridId, setGridId] = useState("imerg-monthly-v07");
  const [indicator, setIndicator] = useState<IndicatorId>("PRCP_ANNUAL");
  const [layer, setLayer] = useState<LayerId>("neutral");
  const [annualVisible, setAnnualVisible] = useState(true);
  const [period, setPeriod] = useState("2001–2024");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [retry, setRetry] = useState(0);
  const {
    catalog,
    context,
    status: catalogStatus,
    error: catalogError,
  } = useGridCatalog(retry);
  const grid = catalog.find((g) => g.id === gridId) ?? catalog[0];
  const activeIndicator = grid?.indicators.includes(indicator)
    ? indicator
    : (grid?.indicators[0] ?? "PRCP_ANNUAL");
  const [start, end] = period.split("–").map(Number);
  const { cells, detail, status, detailStatus, error, detailError } =
    useGridData(grid, activeIndicator, start, end, selectedId, retry);
  const activeCells =
    cells &&
    grid &&
    cells.gridId === grid.id &&
    cells.indicator === activeIndicator &&
    cells.period.start === start &&
    cells.period.end === end
      ? cells
      : null;
  const selected = activeCells?.features.find(
    (f) => f.properties.id === selectedId,
  )?.properties;
  const mapRegions: RegionsGeoJSON = useMemo(() => ({
    type: "FeatureCollection",
    features: (activeCells?.features ?? []).map((f) => ({
      ...f,
      properties: {
        id: f.properties.id,
        name: t("Célula {id}").replace("{id}", f.properties.id),
        abbreviation: "",
        annualValue: f.properties.annualValue,
      },
    })),
  }), [activeCells, t]);
  const values: TrendResult[] = useMemo(() => (activeCells?.features ?? []).flatMap((f) =>
    f.properties.summary
      ? [{ ...f.properties.summary, regionId: f.properties.id, series: [] }]
      : [],
  ), [activeCells]);
  const annualMaximum = activeIndicator === "SOIL_SURFACE" ? 50 : 3000;
  const currentDetail =
    detail &&
    grid &&
    detail.gridId === grid.id &&
    detail.cellId === selectedId &&
    detail.indicator === activeIndicator &&
    detail.period.start === start &&
    detail.period.end === end
      ? detail
      : null;
  const select = (id: string) => {
    setSelectedId(id);
    setSearchError("");
  };
  const changeGrid = (id: string) => {
    setGridId(id);
    const next = catalog.find((g) => g.id === id);
    if (next) setIndicator(next.indicators[0]);
    setSelectedId(null);
    setSearch("");
    setSearchError("");
  };
  return (
    <div className="explorer">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-symbol" aria-hidden="true">
            ╋
          </span>
          <span>
            FORE<span className="brand-light">CAST</span>
            <small>NATIVE GRID EXPLORER / V.03</small>
          </span>
        </a>
        <div className="header-layer">
          {grid ? t(grid.name) : t("Catálogo de grades")} ·{" "}
          {grid?.resolutionDegrees?.toLocaleString(locale) ?? "—"}°
        </div>
        <div className="grid-language-switch" role="group" aria-label={t("Idioma")}>
          <button type="button" aria-label={t("Português")} aria-pressed={language === "pt"} onClick={() => setLanguage("pt")}>PT</button>
          <button type="button" aria-label={t("English")} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
        </div>
        <span className="mode-badge">
          {grid?.available
            ? t("DADOS REAIS / GRADE NATIVA")
            : t("AGUARDANDO DADOS REAIS")}
        </span>
      </header>
      <main className="workspace">
        <aside className="sidebar">
          <div className="intro">
            <div className="eyebrow text-lime-200">
              {t("OBSERVATÓRIO / CÉLULAS NATIVAS")}
            </div>
            <h1>
              {t("Uma célula.")}
              <br />
              {t("Sua própria história.")}
            </h1>
            <p>
              {t("IMERG 0,1° e GLDAS 0,25°, em grades independentes. Estados apenas como contexto geográfico.")}
            </p>
          </div>
          <section className="query-controls grid-query">
            <div className="eyebrow">{t("01 / PRODUTO E GRADE")}</div>
            <label htmlFor="grid">{t("Produto NASA")}</label>
            <select
              id="grid"
              value={grid?.id ?? ""}
              onChange={(e) => changeGrid(e.target.value)}
              disabled={!catalog.length}
            >
              {!catalog.length && <option>{t("Carregando catálogo…")}</option>}
              {catalog.map((g) => (
                <option key={g.id} value={g.id}>
                  {t(g.name)} · {g.resolutionDegrees.toLocaleString(locale)}°
                </option>
              ))}
            </select>
            <p className="control-hint">
              {grid?.productId} · v{grid?.version}
              <br />
              {t("Resolução angular nativa, não resolução constante em km.")}
            </p>
            <label htmlFor="indicator">{t("Indicador")}</label>
            <select
              id="indicator"
              value={activeIndicator}
              disabled={!grid}
              onChange={(e) => {
                setIndicator(e.target.value as IndicatorId);
                setSearchError("");
              }}
            >
              {(grid?.indicators ?? ["PRCP_ANNUAL"]).map((id) => (
                <option key={id} value={id}>
                  {t(indicators[id].name)}
                </option>
              ))}
            </select>
            <label htmlFor="period">{t("Período solicitado")}</label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option>2001–2024</option>
              <option>2001–2012</option>
              <option>2013–2024</option>
            </select>
            <p className="control-hint">
              {grid?.available
                ? t("Revisão {revision}").replace("{revision}", grid.revision)
                : t(grid?.unavailableReason ?? "Verificando disponibilidade.")}
            </p>
          </section>
          <label className="annual-mode">
            <input type="checkbox" checked={annualVisible} onChange={(e) => setAnnualVisible(e.target.checked)} />
            {t("Colorir pelo valor anual de {year}").replace("{year}", String(end))}
          </label>
          {!annualVisible && <LayerSelector value={layer} onChange={setLayer} />}
          <form
            className="cell-search"
            onSubmit={(e) => {
              e.preventDefault();
              const id = search.trim();
              if (activeCells?.features.some((f) => f.properties.id === id))
                select(id);
              else setSearchError("ID não encontrado na grade carregada.");
            }}
          >
            <label htmlFor="cell-search">{t("Selecionar pelo ID nativo")}</label>
            <div>
              <input
                id="cell-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ID fornecido pelo pipeline")}
                disabled={!activeCells?.features.length}
              />
              <button disabled={!activeCells?.features.length}>
                {t("Selecionar")}
              </button>
            </div>
            {searchError && <p role="alert">{t(searchError)}</p>}
          </form>
          <GridCellPanel
            cell={selected}
            grid={grid}
            detail={currentDetail}
            status={detailStatus}
            error={detailError}
            layer={layer}
          />
          <div className="sidebar-foot">
            NASA SPACE APPS <span>{t("GRADES REAIS / API")}</span>
          </div>
        </aside>
        <section className="map-area" aria-label={t("Exploração das grades")}>
          <ClimateMap
            contextRegions={context}
            regions={mapRegions}
            values={values}
            indicator={activeIndicator}
            layer={layer}
            selectedRegionId={selected?.id ?? null}
            onRegionSelect={select}
            annualMaximum={annualVisible ? annualMaximum : undefined}
          />
          <div className="map-top-info">
            <div>
              <span className="eyebrow">PR / SC / RS · WGS84</span>
              <h2>{t("Região Sul")}</h2>
            </div>
            <span className="territory-count">
              {(activeCells?.features.length ?? 0).toLocaleString(locale)}
              <small>{t("CÉLULAS CARREGADAS")}</small>
            </span>
          </div>
          {!grid?.available && catalogStatus === "ready" && (
            <div className="grid-empty" role="status">
              <span className="eyebrow">{t("GRADE AINDA NÃO ENTREGUE")}</span>
              <h3>{grid ? t(grid.name) : t("Nenhuma grade disponível")}</h3>
              <p>
                {t(grid?.unavailableReason ?? "Aguardando dados do pipeline.")}
              </p>
              <p>
                {t("Somente os limites reais do IBGE estão visíveis. Não há células ou valores científicos simulados.")}
              </p>
            </div>
          )}
          <div className="map-footer">
            {annualVisible ? <div className="annual-legend" aria-label={t("Legenda dos valores anuais")}>
              <strong>{t(indicators[activeIndicator].name)} · {end}</strong>
              <div className="annual-gradient" />
              <span>0 — ≥{annualMaximum.toLocaleString(locale)} {indicators[activeIndicator].unit}</span>
              <small>{t("Cinza: ano sem dados completos")}</small>
            </div> : <MapLegend layer={layer} indicator={activeIndicator} />}
            <p className="scientific-note">
              {layer === "neutral"
                ? t("Divisões geográficas = limites das células, quando disponíveis. ")
                : ""}
              {annualVisible ? t("Cor = valor anual, sem teste de tendência. ") : t("Células sem análise ficam neutras. ")}{t("Contorno estadual não representa tendência. Não há interpolação entre grades nem classificação de risco de inundação.")}
            </p>
          </div>
          <div className="data-status" role="status">
            {catalogError || error ? (
              <>
                {t(catalogError || error)}{" "}
                <button onClick={() => setRetry((v) => v + 1)}>
                  {t("Tentar novamente")}
                </button>
              </>
            ) : catalogStatus === "loading" || status === "loading" ? (
              t("Carregando catálogo e geometrias…")
            ) : (
              `${gridApiMode ? "API" : t("Arquivos locais")} · ${grid?.available ? t("grade real disponível") : t("pipeline ainda não executado")} · ${t("séries sob demanda")}`
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
