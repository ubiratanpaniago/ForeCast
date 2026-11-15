import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapGeoJSONFeature } from "maplibre-gl";
import type { IndicatorId } from "../../types/geography";
import type { Crossing, RoadSegment } from "../../services/regionApi";
import {
  useCellFdr,
  useInfrastructure,
  useRegionCatalog,
  useRegionGeometry,
  useRegionSummary,
} from "../../hooks/useRegionalTrends";
import { RegionalMap, type Layers, type Selection } from "./components/RegionalMap";
import { DiagnosisPanel, Badge } from "./components/DiagnosisPanel";
import { SegmentPanel } from "./components/SegmentPanel";
import { State } from "./components/State";
import {
  CLASS_COLOR,
  CLASS_LABEL,
  INDICATOR_INFO,
  REGIONAL_INDICATORS,
  classesFor,
  classify,
} from "./lib/interpretation";

const KM = (v: number) => `${Math.round(v).toLocaleString("pt-BR")} km`;

/** Lê ?regiao=, ?indicador=, ?trecho= para links compartilháveis. */
function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const ind = q.get("indicador") as IndicatorId | null;
  const sel: Selection = q.get("trecho")
    ? { kind: "segment", id: q.get("trecho")! }
    : q.get("regiao")
      ? { kind: "region", id: q.get("regiao")! }
      : null;
  return { indicator: ind && REGIONAL_INDICATORS.includes(ind) ? ind : ("RX1DAY" as IndicatorId), selection: sel };
}

export default function RegionalExplorer() {
  const initial = useMemo(readUrl, []);
  const [indicator, setIndicator] = useState<IndicatorId>(initial.indicator);
  const [selection, setSelection] = useState<Selection>(initial.selection);
  const [layers, setLayers] = useState<Layers>({ terrain: false, roads: initial.selection?.kind === "segment", crossings: false });

  const catalog = useRegionCatalog();
  const geometry = useRegionGeometry();
  // Quatro resumos de ~6 KB (estatística sem séries) classificam todas as regiões; as séries só
  // são lidas para a região aberta no diagnóstico.
  const rx = useRegionSummary("RX1DAY");
  const r50 = useRegionSummary("R50MM");
  const prcp = useRegionSummary("PRCP_ANNUAL");
  const soil = useRegionSummary("SOIL_SURFACE");
  const summaries = { RX1DAY: rx, R50MM: r50, PRCP_ANNUAL: prcp, SOIL_SURFACE: soil };
  const summary = summaries[indicator as keyof typeof summaries];
  const cellFdr = useCellFdr(indicator);
  const infra = useInfrastructure(layers);

  useEffect(() => {
    const q = new URLSearchParams();
    if (indicator !== "RX1DAY") q.set("indicador", indicator);
    if (selection?.kind === "region") q.set("regiao", selection.id);
    if (selection?.kind === "segment" || selection?.kind === "crossing")
      q.set("trecho", selection.kind === "segment" ? selection.id : selection.segmentId);
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [indicator, selection]);

  const regionColor = useCallback(
    (id: string) => {
      if (summary.status !== "ready") return null;
      const level = catalog.status === "ready" ? catalog.data.regions.find((r) => r.id === id)?.level : undefined;
      if (level === "estado") return null; // estados aparecem só como contorno
      return CLASS_COLOR[classify(indicator, summary.data.regions[id])];
    },
    [summary, catalog, indicator],
  );

  const counts = useMemo(() => {
    if (summary.status !== "ready" || catalog.status !== "ready") return null;
    const out: Record<string, number> = {};
    for (const r of catalog.data.regions.filter((x) => x.level === "regiao_intermediaria")) {
      const c = classify(indicator, summary.data.regions[r.id]);
      out[c] = (out[c] ?? 0) + 1;
    }
    return out;
  }, [summary, catalog, indicator]);

  const roadsById = useMemo(() => {
    const m = new Map<string, RoadSegment>();
    if (infra.roads.status === "ready") for (const f of infra.roads.data.features) m.set(f.properties.id, f.properties);
    return m;
  }, [infra.roads]);

  const regionInfo =
    selection?.kind === "region" && catalog.status === "ready"
      ? catalog.data.regions.find((r) => r.id === selection.id)
      : undefined;
  const segmentId = selection?.kind === "segment" ? selection.id : selection?.kind === "crossing" ? selection.segmentId : null;
  const segment = segmentId ? roadsById.get(segmentId) : undefined;
  const segmentCrossings: Crossing[] =
    segmentId && infra.crossings.status === "ready"
      ? infra.crossings.data.features.map((f) => f.properties).filter((c) => c.segmentId === segmentId)
      : [];

  // Abrir um trecho liga as travessias, para que a lista e o mapa coincidam.
  useEffect(() => {
    if (segmentId && !layers.crossings) setLayers((l) => ({ ...l, crossings: true }));
  }, [segmentId]);

  const tooltip = useCallback(
    (f: MapGeoJSONFeature) => {
      const p = f.properties as Record<string, unknown>;
      if (f.layer.id === "crossing-dot") return `Travessia candidata · ${p.ref} · ${p.lengthKm} km em célula de relevo alta`;
      if (f.layer.id === "road-line") return `${p.ref} · ${p.regionName} · ${p.lengthKm} km`;
      const c = summary.status === "ready" ? CLASS_LABEL[classify(indicator, summary.data.regions[String(p.id)])] : "";
      return `${p.name}${p.level === "estado" ? "" : ` · ${c}`}`;
    },
    [summary, indicator],
  );

  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const info = INDICATOR_INFO[indicator];
  const infraTotals = infra.catalog.status === "ready" ? infra.catalog.data.totals : null;

  return (
    <div className="page rg-page">
      <header className="masthead">
        <div className="masthead-row">
          <span className="brand">ForeCast · Investigação regional</span>
          <nav className="rg-nav mono">
            <a href="/">Dossiê</a>
            <a href="/grids">Grades nativas</a>
          </nav>
        </div>
        <h1 className="rg-title">
          Onde a chuva extrema está mudando no Sul — <em>e por onde passam as rodovias.</em>
        </h1>
        <p className="lede">
          Tendências 2001–2024 (Mann-Kendall, Theil-Sen, FDR por célula) em 21 regiões intermediárias do IBGE, sobre dados
          NASA IMERG e GLDAS, cruzadas com BRs e rodovias estaduais e a suscetibilidade preliminar do relevo (NASADEM).
          Evidência de mudança no perigo, não risco de desastre.
        </p>
      </header>

      <div className="rg-controls">
        <div className="rg-tabs" role="group" aria-label="Indicador">
          {REGIONAL_INDICATORS.map((i) => (
            <button key={i} aria-pressed={i === indicator} onClick={() => setIndicator(i)} title={INDICATOR_INFO[i].question}>
              <span className="mono">{INDICATOR_INFO[i].short}</span>
              {INDICATOR_INFO[i].label}
            </button>
          ))}
        </div>
        <div className="rg-layers" role="group" aria-label="Camadas">
          {(
            [
              ["terrain", "Relevo NASADEM"],
              ["roads", "Rodovias"],
              ["crossings", "Travessias candidatas"],
            ] as const
          ).map(([k, label]) => (
            <label key={k}>
              <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} /> {label}
              {layers[k] && infra[k].status === "loading" && <span className="rg-spinner" aria-label="carregando" />}
            </label>
          ))}
        </div>
      </div>

      <div className="rg-layout">
        <div className="rg-map-col">
          <p className="rg-q">
            <strong>{info.question}</strong> <span className="muted mono">{info.product}</span>
          </p>
          <RegionalMap
            regions={geometry.status === "ready" ? geometry.data : null}
            regionColor={regionColor}
            colorKey={`${indicator}:${summary.status}:${catalog.status}`}
            terrain={infra.terrain.status === "ready" ? (infra.terrain.data as never) : null}
            roads={infra.roads.status === "ready" ? (infra.roads.data as never) : null}
            crossings={infra.crossings.status === "ready" ? (infra.crossings.data as never) : null}
            layers={layers}
            selection={selection}
            onSelect={setSelection}
            tooltip={tooltip}
          />
          <div className="rg-legend">
            <State state={summary} what={`resultados de ${info.short}`} compact>
              {() => (
                <ul className="rg-legend-classes">
                  {classesFor(indicator).map((c) => (
                    <li key={c}>
                      <i style={{ background: CLASS_COLOR[c] }} aria-hidden /> {CLASS_LABEL[c]}
                      <span className="mono muted"> {counts?.[c] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              )}
            </State>
            {layers.terrain && (
              <ul className="rg-legend-classes">
                <li className="muted">Relevo (fração de planície baixa por célula de 0,1°):</li>
                <li><i style={{ background: "#4a7c8c" }} /> alta ≥ 15%</li>
                <li><i style={{ background: "#9bbcc4" }} /> média 2–15%</li>
                <li><i style={{ background: "#e4ddcd" }} /> baixa</li>
              </ul>
            )}
            {(layers.roads || layers.crossings) && (
              <ul className="rg-legend-classes">
                {layers.roads && (
                  <>
                    <li><i className="rg-line rg-line--federal" /> BR (federal)</li>
                    <li><i className="rg-line" /> estadual</li>
                  </>
                )}
                {layers.crossings && <li><i className="rg-ring" /> travessia candidata</li>}
              </ul>
            )}
            {geometry.status === "error" && <State state={geometry} what="limites das regiões" compact>{() => null}</State>}
          </div>
        </div>

        <aside className="rg-side">
          {regionInfo ? (
            <DiagnosisPanel
              region={regionInfo}
              indicator={indicator}
              onIndicator={setIndicator}
              summaries={summaries}
              cellFdr={cellFdr}
              onClose={() => setSelection(null)}
            />
          ) : segmentId ? (
            <State state={infra.roads} what="rodovias">
              {() =>
                segment ? (
                  <SegmentPanel
                    segment={segment}
                    crossings={segmentCrossings}
                    selectedCrossing={selection?.kind === "crossing" ? selection.id : null}
                    catalog={infra.catalog.status === "ready" ? infra.catalog.data : null}
                    onCrossing={(c) => setSelection({ kind: "crossing", id: c.id, segmentId: c.segmentId })}
                    onClose={() => setSelection(null)}
                  />
                ) : (
                  <p className="rg-state rg-state--error">Trecho {segmentId} não encontrado.</p>
                )
              }
            </State>
          ) : (
            <section className="rg-panel">
              <p className="eyebrow">Síntese · {info.label}</p>
              <State state={summary} what="síntese">
                {() => {
                  const sig = (counts?.worsening ?? 0) + (counts?.easing ?? 0) + (counts?.increase ?? 0) + (counts?.decrease ?? 0);
                  return (
                    <>
                      <p className="rg-big">
                        <span className="rg-num">{sig}</span> de 21 regiões com tendência significativa
                      </p>
                      <ul className="rg-sum">
                        {classesFor(indicator).map((c) => (
                          <li key={c}>
                            <Badge cls={c} /> <span className="mono">{counts?.[c] ?? 0}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="muted rg-small">
                        Período 2001–2024. Direção atribuída pelo pipeline quando p &lt; 0,05 e o IC 95 % de Sen exclui o zero, sem
                        correção para testes múltiplos entre regiões. Clique numa região para o diagnóstico completo, com o teste FDR
                        por célula.
                      </p>
                    </>
                  );
                }}
              </State>
              {infraTotals && (
                <>
                  <h3 className="rg-h">Rodovias × relevo</h3>
                  <p>
                    {KM(infraTotals.lengthKm)} em {infraTotals.segments} trechos; {KM(infraTotals.lengthByClassKm.alta)} (
                    {Math.round((infraTotals.lengthByClassKm.alta / infraTotals.lengthKm) * 100)}%) em células de suscetibilidade
                    alta; {infraTotals.crossings} travessias candidatas.
                  </p>
                  <p className="muted rg-small">Ligue “Rodovias” e clique num trecho para ver a exposição. Diagnóstico exploratório.</p>
                </>
              )}
              {!infraTotals && (
                <p className="muted rg-small">
                  Ligue “Rodovias” ou “Relevo NASADEM” para o diagnóstico exploratório de exposição dos trechos.
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
