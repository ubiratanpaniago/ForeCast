import { useMemo, useState } from "react";
import type { MapMode, SeriesKey, Snapshot } from "./types/climate";
import {
  anomalyPct,
  readCell,
  useGridLand,
  useSnapshot,
  useYearSummary,
} from "./hooks/useRegionData";
import { pct } from "./lib/format";
import ClimateMap from "./components/Map/ClimateMap";
import { Legend } from "./components/Map/MapLayers";
import RegionPanel from "./components/Dashboard/RegionPanel";
import YearStrip from "./components/Dashboard/YearStrip";
import ForecastCard from "./components/Dashboard/ForecastCard";
import HistoricalChart from "./components/Charts/HistoricalChart";
import ProjectionChart from "./components/Charts/ProjectionChart";
import { MonthlyRainExplorer } from "./components/MonthlyRainExplorer";
import { useTemporalPlayback } from "./hooks/useTemporalPlayback";
import "./styles/dossier-layout.css";
import { YearComparison } from "./components/Dashboard/YearComparison";
import { DataCoverage } from "./components/Dashboard/DataCoverage";
import { BlockSelector } from "./components/Dashboard/BlockSelector";
import { snapshotMode } from "./services/api";

export default function App() {
  const state = useSnapshot();
  if (state.status === "loading")
    return <div className="status">Abrindo o dossiê…</div>;
  if (state.status === "error")
    return (
      <div className="status status--error">
        <p className="eyebrow">Evidência ausente</p>
        <p>{state.error}</p>
        <button onClick={state.retry}>Tentar novamente</button>
      </div>
    );
  return <Dossier data={state.data} />;
}

function Dossier({ data }: { data: Snapshot }) {
  const land = useGridLand(data);
  const [year, setYear] = useState(data.years[data.years.length - 1]);
  const playback = useTemporalPlayback(data.years, year, setYear);
  const [mode, setMode] = useState<MapMode>("anomaly");
  const [series, setSeries] = useState<SeriesKey>("precipitation");
  const [pinnedIJ, setPinnedIJ] = useState<[number, number] | null>(null);
  const [hoverIJ, setHoverIJ] = useState<[number, number] | null>(null);
  const summary = useYearSummary(data, year);
  const activeIJ = hoverIJ ?? pinnedIJ;
  const cell = activeIJ
    ? readCell(data, land, year, activeIJ[0], activeIJ[1])
    : null;

  const extremes = useMemo(() => {
    const { regional, regionalClimatology } = data.annual;
    const sorted = [...data.years].sort((a, b) => regional[a] - regional[b]);
    const a = (y: number) => anomalyPct(regional[y], regionalClimatology);
    return {
      dry: sorted[0],
      wet: sorted[sorted.length - 1],
      dryA: a(sorted[0]),
      wetA: a(sorted[sorted.length - 1]),
    };
  }, [data]);

  const { bbox } = data.meta;

  return (
    <div className="dossier">
      <a className="dossier-skip" href="#dossie-conteudo">Ir para o conteúdo</a>
      <header className="dossier-topbar">
        <a href="/" className="dossier-brand" aria-label="ForeCast, voltar ao início">
          ForeCast<span>.</span>
        </a>
        <nav className="dossier-nav" aria-label="Seções">
          <a href="/entenda" aria-current="page">Dossiê exploratório</a>
          <span aria-hidden="true">•</span>
          <span>{snapshotMode === "api" ? "Dados via API" : "Arquivo estático"}</span>
          <span aria-hidden="true">•</span>
          <a href="/grids">Explorador de grades nativas</a>
          <span aria-hidden="true">•</span>
          <a href="/regioes">Investigação regional</a>
        </nav>
        <div className="dossier-actions">
          <a href="/analise">Estradas</a>
          <a href="#detalhes">Detalhes</a>
          <a href="/apoio" className="is-primary">Apoio</a>
        </div>
      </header>
      <p className="dossier-bbox mono">
        BBOX de estudo: {Math.abs(bbox.west)}–{Math.abs(bbox.east)}°O,{" "}
        {Math.abs(bbox.south)}–{Math.abs(bbox.north)}°S
      </p>

      <main className="dossier-main" id="dossie-conteudo">
        <div className="dossier-hero">
          <h1>Vinte e quatro anos de chuva, examinados célula a célula.</h1>
          <p>
            Satélite GPM IMERG, 2001–2024. Menor média:{" "}
            <button className="inline-year is-dry" onClick={() => playback.selectYear(extremes.dry)}>
              {extremes.dry} ({pct(extremes.dryA)})
            </button>
            . Maior média:{" "}
            <button className="inline-year is-wet" onClick={() => playback.selectYear(extremes.wet)}>
              {extremes.wet} ({pct(extremes.wetA)})
            </button>
            .
          </p>
        </div>

        <div className="dossier-grid">
          <div className="dossier-col dossier-col--map">
            <MonthlyRainExplorer compact />
          </div>
          <div className="dossier-col dossier-col--compare">
            <h2 className="dossier-col-title">Dois anos, a mesma referência</h2>
            <p className="dossier-col-sub">Contexto anual agregado {data.years[0]}–{data.years.at(-1)}</p>
            <YearStrip data={data} year={year} onSelect={playback.selectYear} />
            <YearComparison
              data={data}
              year={year}
              onSelectYear={playback.selectYear}
              block={pinnedIJ}
            />
          </div>
        </div>
      </main>

      <section className="dossier-details page" id="detalhes" aria-label="Detalhes">
      <p className="dossier-details-title eyebrow">Detalhes · método, contexto anual e cobertura</p>
      <aside className="scope-notice">
        <strong>Mapa mensal em grade nativa IMERG de 0,1°.</strong> Células com
        interseção em PR, SC e RS, sem interpolação. As comparações anuais
        usam o snapshot agregado de 0,2°. Anomalia não é previsão nem risco de inundação.
      </aside>
      <details className="annual-context"><summary>Consultar o mapa anual agregado e a sonda de blocos 0,2°</summary>
      <section className="exhibit exhibit--map">
        <div className="exhibit-head">
          <p className="exhibit-tag">Contexto anual</p>
          <h2>
            {mode === "anomaly" ? "Anomalia" : "Total"} de precipitação,{" "}
            <span className="year-mark">{year}</span>
          </h2>
          <div className="seg" role="tablist" aria-label="Modo do mapa">
            <button
              role="tab"
              aria-selected={mode === "anomaly"}
              className="seg-btn"
              onClick={() => setMode("anomaly")}
            >
              Anomalia %
            </button>
            <button
              role="tab"
              aria-selected={mode === "total"}
              className="seg-btn"
              onClick={() => setMode("total")}
            >
              Total mm
            </button>
          </div>
        </div>
        <div className="map-layout">
          <div>
            <ClimateMap
              data={data}
              land={land}
              year={year}
              mode={mode}
              hovered={cell}
              onHover={setHoverIJ}
              onSelect={(ij) => {
                setPinnedIJ(ij);
                setHoverIJ(null);
              }}
            />
            <BlockSelector
              data={data}
              selected={pinnedIJ}
              onSelect={(ij) => {
                setPinnedIJ(ij);
                setHoverIJ(null);
              }}
              onClear={() => {
                setPinnedIJ(null);
                setHoverIJ(null);
              }}
            />
            <Legend mode={mode} />
          </div>
          <RegionPanel data={data} summary={summary} cell={cell} />
        </div>
      </section>
      </details>

      <section className="exhibit">
        <div className="exhibit-head">
          <p className="exhibit-tag">Peça B</p>
          <h2>Série mensal do recorte terrestre do BBOX</h2>
          <p className="exhibit-aside muted">
            Clique no gráfico para ir ao ano.
          </p>
        </div>
        <HistoricalChart
          data={data}
          series={series}
          onSeriesChange={setSeries}
          year={year}
          onSelectYear={playback.selectYear}
        />
      </section>

      <DataCoverage data={data} />
      <div className="pending-row">
        <section className="exhibit">
          <div className="exhibit-head">
            <p className="exhibit-tag">Peça C</p>
            <h2>Extremos históricos</h2>
          </div>
          <ForecastCard />
        </section>

        <section className="exhibit">
          <div className="exhibit-head">
            <p className="exhibit-tag">Peça D</p>
            <h2>Tendências estatísticas</h2>
          </div>
          <ProjectionChart />
        </section>
      </div>

      <footer className="colophon">
        <div>
          <p className="eyebrow">Fontes</p>
          <ul>
            {data.meta.sources.map((s) => (
              <li key={s.key}>
                <span className="mono">{s.product}</span> — {s.variable} (
                {s.unit})
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Ressalvas</p>
          <ul>
            {data.meta.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>
              No contexto anual: médias espaciais de totais anuais em blocos de 0,2° (2×2
              da grade nativa IMERG). A sonda não representa uma célula nativa;
              máscara GLDAS não é linha da costa oficial.
            </li>
          </ul>
        </div>
        <p className="mono muted colophon-stamp">
          snapshot gerado em{" "}
          {new Date(data.meta.generated).toLocaleString("pt-BR")}
        </p>
      </footer>
      </section>
      <footer className="dossier-footer">
        <span>ForeCast · Paraná, Santa Catarina e Rio Grande do Sul</span>
        <span>Dados NASA · Informações históricas, sem avaliação de rota segura.</span>
      </footer>
    </div>
  );
}
