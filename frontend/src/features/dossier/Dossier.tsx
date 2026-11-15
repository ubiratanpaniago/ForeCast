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
import { TemporalPlayer } from "./components/TemporalPlayer";
import { useTemporalPlayback } from "./hooks/useTemporalPlayback";
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
    <div className="page">
      <header className="masthead">
        <div className="masthead-row">
          <span className="brand">ForeCast · Dossiê exploratório</span>
          <span className="mono muted">
            {snapshotMode === "api"
              ? "Dados via API"
              : "Arquivo estático · modo demonstração"}
          </span>
          <a href="/grids">Explorador de grades nativas →</a>
          <span className="mono muted">
            Dossiê 01 · BBOX de estudo · {Math.abs(bbox.west)}°–
            {Math.abs(bbox.east)}°O, {Math.abs(bbox.south)}°–
            {Math.abs(bbox.north)}°S
          </span>
        </div>
        <h1>
          Vinte e quatro anos de chuva,
          <br />
          <em>examinados célula a célula.</em>
        </h1>
        <p className="lede">
          Satélite GPM IMERG, 2001–2024. O ano com menor média de precipitação
          no recorte terrestre do BBOX foi{" "}
          <button
            className="inline-year is-dry"
            onClick={() => playback.selectYear(extremes.dry)}
          >
            {extremes.dry} ({pct(extremes.dryA)})
          </button>
          ; o de maior média,{" "}
          <button
            className="inline-year is-wet"
            onClick={() => playback.selectYear(extremes.wet)}
          >
            {extremes.wet} ({pct(extremes.wetA)})
          </button>
          . Escolha um ano para abrir o laudo.
        </p>
      </header>

      <aside className="scope-notice">
        <strong>Visualização agregada, não grade nativa.</strong> IMERG em
        blocos 0,2°; médias do BBOX com máscara de validade GLDAS, sem recorte
        por estados. Anomalia anual não é tendência estatística nem risco de
        inundação.
      </aside>
      <section className="timeline" aria-label="Linha do tempo">
        <div className="timeline-head">
          <span className="eyebrow">
            Anomalia da média anual do recorte, em relação à média 2001–2024
          </span>
          <span className="mono muted">← → para navegar</span>
        </div>
        <YearStrip data={data} year={year} onSelect={playback.selectYear} />
      </section>

      <section className="exhibit exhibit--map">
        <div className="exhibit-head">
          <p className="exhibit-tag">Peça A</p>
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
        <TemporalPlayer years={data.years} year={year} playback={playback} />
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

      <YearComparison
        data={data}
        year={year}
        onSelectYear={playback.selectYear}
        block={pinnedIJ}
      />
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
              Médias espaciais de totais anuais exibidas em blocos de 0,2° (2×2
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
    </div>
  );
}
