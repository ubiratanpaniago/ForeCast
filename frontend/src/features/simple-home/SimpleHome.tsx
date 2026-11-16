import { useEffect, useMemo, useState } from "react";
import type { RegionsGeoJSON } from "../../types/geography";
import { getRegionGeometry } from "../../services/regionApi";
import { MonthlyRainMap } from "../dossier/components/MonthlyRainMap";
import { useMonthlyRainfall } from "../dossier/hooks/useMonthlyRainfall";
import { monthlyAnomaly } from "../dossier/services/monthlyApi";
import { HomeHistory } from "./HomeHistory";
import { EXAMPLE_CELL_ID, fullMonth, placeName, rainDescription } from "./homeData";
import { TopNavigation } from "../../components/TopNavigation";
import { useLanguage } from "../../i18n/LanguageContext";
import "./simple-home.css";

const mm = (value: number | null, locale: string) => value === null ? (locale === "en-US" ? "No data" : "Sem dados") : `${value.toLocaleString(locale, { maximumFractionDigits: 0 })} mm`;

function RainBar({ label, value, maximum, kind, locale }: {
  label: string; value: number | null; maximum: number; kind: "recorded" | "average"; locale: string;
}) {
  return <div className="home-rain-row">
    <div className="home-rain-label"><span>{label}</span><strong>{mm(value, locale)}</strong></div>
    <div className="home-rain-track" aria-hidden="true">
      {value !== null && <span className={`home-rain-fill ${kind}`} style={{ width: `${value / maximum * 100}%` }} />}
    </div>
  </div>;
}

export default function SimpleHome() {
  const { t, language } = useLanguage();
  const locale = language === "en" ? "en-US" : "pt-BR";
  const month = "2024-12";
  const [selectedId, setSelectedId] = useState(EXAMPLE_CELL_ID);
  const [retry, setRetry] = useState(0);
  const [regions, setRegions] = useState<RegionsGeoJSON | null>(null);
  const { manifest, frame, error } = useMonthlyRainfall(month, retry);
  const ready = !!frame && !error;
  useEffect(() => {
    let active = true;
    void getRegionGeometry().then(data => { if (active) setRegions(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const selected = useMemo(() => {
    if (!manifest || !selectedId) return null;
    const index = manifest.cells.findIndex(c => c.id === selectedId);
    return index >= 0 ? index : null;
  }, [manifest, selectedId]);
  const reference = manifest?.climatology[month.slice(5, 7)];
  const summary = useMemo(() => {
    if (!frame || !reference) return { value: null, reference: null, count: 0 };
    if (selected !== null) return { value: frame.values[selected], reference: reference[selected], count: 1 };
    return { value: null, reference: null, count: 0 };
  }, [frame, reference, selected]);
  const location = useMemo(() => {
    if (!manifest || selected === null) return t("Exemplo no Sul do Brasil");
    const index = manifest.cells[selected].index;
    const name = placeName(regions, manifest.grid.lon[index % manifest.grid.lon.length], manifest.grid.lat[Math.floor(index / manifest.grid.lon.length)]);
    return language === "en" && name.startsWith("Região de ") ? `Region of ${name.slice("Região de ".length)}` : name;
  }, [manifest, selected, regions, language, t]);
  const anomaly = ready ? monthlyAnomaly(summary.value, summary.reference) : null;
  const maximum = Math.max(summary.value ?? 0, summary.reference ?? 0, 1);
  const changePoint = (i: number) => { if (manifest) setSelectedId(manifest.cells[i].id); };
  const point = manifest && selected !== null ? manifest.cells[selected].index : null;
  const latitude = point !== null && manifest ? manifest.grid.lat[Math.floor(point / manifest.grid.lon.length)] : null;
  const longitude = point !== null && manifest ? manifest.grid.lon[point % manifest.grid.lon.length] : null;

  return <div className="simple-home">
    <a className="home-skip" href="#home-main">{t("Ir para o conteúdo")}</a>
    <TopNavigation page="home" title="As chuvas na sua região" subtitle="Veja o mapa. Escolha um lugar. Entenda as mudanças." />
    <main id="home-main" className="home-dashboard" tabIndex={-1}>
      <section className="home-map-column" aria-labelledby="home-map-title">
        <div className="home-map-heading"><h2 id="home-map-title">{t("Onde choveu mais ou menos")}</h2>
          <p>{t("Clique em um lugar para ver os dados ao lado.")}</p></div>
        <div className="home-static-date"><span>{t("Dados históricos")}</span><strong>{fullMonth(month, locale)}</strong></div>
        {error ? <div className="home-data-message" role="alert"><h3>{t("Não conseguimos carregar as chuvas.")}</h3><p>{t("Tente novamente para ver o mapa.")}</p><button onClick={() => setRetry(v => v + 1)}>{t("Tentar novamente")}</button></div>
          : !manifest ? <div className="home-data-message" role="status">{t("Carregando o mapa de chuvas…")}</div>
          : <MonthlyRainMap manifest={manifest} values={ready ? frame!.values : null} month={month} mode="anomaly" selected={selected} onSelect={changePoint} />}
        <div className="home-map-key" aria-label={t("Legenda das cores")}>
          <span><i className="home-dry-swatch" /> {t("Menos chuva")}</span><span><i className="home-normal-swatch" /> {t("Perto da média")}</span><span><i className="home-wet-swatch" /> {t("Mais chuva")}</span>
        </div>
        <p className="home-map-key-note">{t("Comparação com o mesmo mês de outros anos. Cinza: sem dados para mostrar.")}</p>
        <p className="home-static-note">{t("Este mapa mostra o passado. Para explorar outros meses, clique em “Entenda”.")}</p>
      </section>
      <div className="home-reading-column">
        <section className="home-summary" aria-labelledby="home-summary-title">
          <div className="home-section-heading"><h2 id="home-summary-title">{t("Chuva na região escolhida")}</h2></div>
          <div className="home-place"><span className="home-place-dot" aria-hidden="true"/><strong>{location}</strong>
            {selectedId !== EXAMPLE_CELL_ID && <button onClick={() => setSelectedId(EXAMPLE_CELL_ID)}>{t("Voltar ao exemplo")}</button>}</div>
          <p className="home-place-note">{selectedId === EXAMPLE_CELL_ID ? t("Localização de exemplo. Não é a sua localização atual.") : t("Dados do ponto aproximado que você escolheu.")}</p>
          {latitude !== null && longitude !== null && <p className="home-coordinate">{t("Coordenada:")} {Math.abs(latitude).toLocaleString(locale, {maximumFractionDigits:2})}° S · {Math.abs(longitude).toLocaleString(locale, {maximumFractionDigits:2})}° {language === "en" ? "W" : "O"}</p>}
          <p className={`home-comparison ${anomaly !== null && anomaly < 0 ? "drier" : "wetter"}`} aria-live="polite">
            {!ready ? t("Aguardando os dados do mês…") : rainDescription(anomaly, locale)}</p>
          <div className="home-bars">
            <RainBar label={t("No mês do mapa")} value={ready ? summary.value : null} maximum={maximum} kind="recorded" locale={locale}/>
            <RainBar label={t("Média histórica desse mês")} value={ready ? summary.reference : null} maximum={maximum} kind="average" locale={locale}/>
          </div>
          <p className="home-reference-explanation">{t("Referência: o mesmo mês, de 2001 a 2024.")}</p>
          <div className="home-forecast-note"><span className="home-unavailable-dot" aria-hidden="true"/><span>{t("Previsão de chuva:")} <strong>{t("ainda não disponível")}</strong></span></div>
        </section>
        <HomeHistory manifest={selected !== null ? manifest : null} cellId={selectedId} month={month} location={location}/>
        <a className="home-understand" href="/entenda"><span><strong>{t("Entenda o que está acontecendo")}</strong><small>{t("Veja a evolução das chuvas com mais detalhes.")}</small></span><span aria-hidden="true">→</span></a>
      </div>
    </main>
    <footer className="home-footer"><span>{t("ForeCast · Paraná, Santa Catarina e Rio Grande do Sul")}</span><span>{t("Dados NASA · Informações históricas, sem avaliação de rota segura.")}</span></footer>

  </div>;
}
