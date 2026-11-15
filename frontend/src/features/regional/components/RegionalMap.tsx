import { useEffect, useRef, useState } from "react";
import {
  Map as LibreMap,
  NavigationControl,
  AttributionControl,
  setWorkerUrl,
  type GeoJSONSource,
  type Map as MapInstance,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { RegionsGeoJSON } from "../../../types/geography";
setWorkerUrl(workerUrl);

export interface Layers {
  terrain: boolean;
  roads: boolean;
  crossings: boolean;
}

export type Selection =
  | { kind: "region"; id: string }
  | { kind: "segment"; id: string }
  | { kind: "crossing"; id: string; segmentId: string }
  | null;

interface Props {
  regions: RegionsGeoJSON | null;
  /** cor de cada região (classe do indicador ativo); null = sem preenchimento */
  regionColor: (id: string) => string | null;
  colorKey: string;
  terrain: GeoJSON.FeatureCollection | null;
  roads: GeoJSON.FeatureCollection | null;
  crossings: GeoJSON.FeatureCollection | null;
  layers: Layers;
  selection: Selection;
  onSelect: (s: Selection) => void;
  tooltip: (f: MapGeoJSONFeature) => string | null;
}

const BOUNDS: [[number, number], [number, number]] = [
  [-58, -34],
  [-47, -22],
];
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const TERRAIN_COLORS = ["match", ["get", "class"], 3, "#4a7c8c", 2, "#9bbcc4", "#e4ddcd"];

/** Mapa das regiões intermediárias com camadas opcionais de relevo, rodovias e travessias. */
export function RegionalMap(props: Props) {
  const { regions, regionColor, colorKey, terrain, roads, crossings, layers, selection, onSelect, tooltip } = props;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const handlers = useRef({ onSelect, tooltip });
  handlers.current = { onSelect, tooltip };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!box.current) return;
    let m: MapInstance;
    try {
      m = new LibreMap({
        container: box.current,
        bounds: BOUNDS,
        fitBoundsOptions: { padding: 24 },
        minZoom: 4,
        maxZoom: 13,
        attributionControl: false,
        dragRotate: false,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": "#eae4d6" } }],
        },
      });
    } catch {
      setError("Este navegador não conseguiu iniciar o mapa (WebGL indisponível).");
      return;
    }
    m.touchZoomRotate.disableRotation();
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: "Limites: IBGE · Rodovias: © colaboradores do OpenStreetMap (ODbL) · Relevo: NASA NASADEM",
      }),
    );
    map.current = m;
    m.on("load", () => {
      for (const id of ["regions", "terrain", "roads", "crossings"])
        m.addSource(id, { type: "geojson", data: EMPTY, promoteId: "id" });
      m.addLayer({
        id: "region-fill",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": ["coalesce", ["feature-state", "color"], "#f4efe4"],
          "fill-opacity": ["case", ["boolean", ["feature-state", "hasColor"], false], 0.78, 0.55],
        },
      });
      m.addLayer({
        id: "terrain-fill",
        type: "fill",
        source: "terrain",
        layout: { visibility: "none" },
        paint: { "fill-color": TERRAIN_COLORS as never, "fill-opacity": ["match", ["get", "class"], 3, 0.75, 2, 0.5, 0.12] },
      });
      m.addLayer({
        id: "region-line",
        type: "line",
        source: "regions",
        paint: {
          "line-color": "#1b1a16",
          "line-width": ["match", ["get", "level"], "estado", 1.8, 0.6],
          "line-opacity": ["match", ["get", "level"], "estado", 0.9, 0.5],
        },
      });
      m.addLayer({
        id: "road-casing",
        type: "line",
        source: "roads",
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f8f5ee",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "jurisdiction"], "federal", 2.6, 1.6], 10, ["match", ["get", "jurisdiction"], "federal", 7, 4.5]],
        },
      });
      m.addLayer({
        id: "road-line",
        type: "line",
        source: "roads",
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#c2410c",
            ["match", ["get", "jurisdiction"], "federal", "#1b1a16", "#6d675b"],
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "jurisdiction"], "federal", 1.4, 0.7], 10, ["match", ["get", "jurisdiction"], "federal", 4, 2.5]],
        },
      });
      m.addLayer({
        id: "crossing-dot",
        type: "circle",
        source: "crossings",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 10, 6],
          "circle-color": ["case", ["boolean", ["feature-state", "selected"], false], "#c2410c", "#f8f5ee"],
          "circle-stroke-color": "#c2410c",
          "circle-stroke-width": 1.4,
        },
      });
      m.addLayer({
        id: "region-selected",
        type: "line",
        source: "regions",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#c2410c", "line-width": 3 },
      });
      setReady(true);
    });
    // Prioridade: travessia > trecho > região intermediária > estado (os estados se sobrepõem às regiões).
    const rank = (f: MapGeoJSONFeature) =>
      f.layer.id === "crossing-dot" ? 0 : f.layer.id === "road-line" ? 1 : f.properties?.level === "estado" ? 3 : 2;
    const pick = (point: { x: number; y: number }) =>
      m
        .queryRenderedFeatures([point.x, point.y] as never, {
          layers: ["crossing-dot", "road-line", "region-fill"].filter((l) => m.getLayer(l) && m.getLayoutProperty(l, "visibility") !== "none"),
        })
        .sort((a, b) => rank(a) - rank(b))[0];
    m.on("mousemove", (e) => {
      const f = pick(e.point);
      m.getCanvas().style.cursor = f ? "pointer" : "";
      const text = f ? handlers.current.tooltip(f) : null;
      setTip(text ? { text, x: e.point.x, y: e.point.y } : null);
    });
    m.on("mouseout", () => setTip(null));
    m.on("click", (e) => {
      const f = pick(e.point);
      const p = f?.properties as Record<string, string> | undefined;
      if (!f || !p) return handlers.current.onSelect(null);
      if (f.layer.id === "crossing-dot") handlers.current.onSelect({ kind: "crossing", id: p.id, segmentId: p.segmentId });
      else if (f.layer.id === "road-line") handlers.current.onSelect({ kind: "segment", id: p.id });
      else handlers.current.onSelect({ kind: "region", id: p.id });
    });
    m.on("error", (e) => {
      if (!/abort/i.test(String(e.error?.message))) setError("Falha ao desenhar o mapa.");
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  const setData = (id: string, data: GeoJSON.FeatureCollection | null) => {
    if (ready) (map.current!.getSource(id) as GeoJSONSource).setData(data ?? EMPTY);
  };
  useEffect(() => setData("regions", regions as never), [ready, regions]);
  useEffect(() => setData("terrain", terrain), [ready, terrain]);
  useEffect(() => setData("roads", roads), [ready, roads]);
  useEffect(() => setData("crossings", crossings), [ready, crossings]);

  useEffect(() => {
    if (!ready || !regions) return;
    for (const f of regions.features) {
      const c = regionColor(f.properties.id);
      map.current!.setFeatureState({ source: "regions", id: f.properties.id }, { color: c, hasColor: !!c });
    }
  }, [ready, regions, colorKey]);

  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    m.setLayoutProperty("terrain-fill", "visibility", layers.terrain ? "visible" : "none");
    for (const l of ["road-casing", "road-line"]) m.setLayoutProperty(l, "visibility", layers.roads ? "visible" : "none");
    m.setLayoutProperty("crossing-dot", "visibility", layers.crossings ? "visible" : "none");
  }, [ready, layers]);

  // destaque da seleção
  const prev = useRef<{ source: string; id: string } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    if (prev.current) m.setFeatureState(prev.current, { selected: false });
    prev.current = null;
    m.setFilter("region-selected", ["==", ["get", "id"], selection?.kind === "region" ? selection.id : ""]);
    if (selection?.kind === "segment" || selection?.kind === "crossing") {
      const target = { source: "roads", id: selection.kind === "segment" ? selection.id : selection.segmentId };
      m.setFeatureState(target, { selected: true });
      prev.current = target;
      if (selection.kind === "crossing") {
        const c = { source: "crossings", id: selection.id };
        m.setFeatureState(c, { selected: true });
        const f = crossings?.features.find((x) => x.properties?.id === selection.id);
        if (f?.geometry.type === "Point") m.easeTo({ center: f.geometry.coordinates as [number, number], zoom: Math.max(m.getZoom(), 9) });
      }
    }
  }, [ready, selection, crossings]);
  useEffect(() => {
    if (!ready || selection?.kind !== "crossing") return;
    const m = map.current!;
    return () => {
      m.setFeatureState({ source: "crossings", id: selection.id }, { selected: false });
    };
  }, [ready, selection]);

  return (
    <div className="rg-map">
      <div ref={box} className="rg-map-canvas" role="region" aria-label="Mapa de PR, SC e RS" />
      {!ready && !error && <div className="rg-map-msg">Carregando mapa…</div>}
      {error && <div className="rg-map-msg rg-map-msg--error">{error}</div>}
      {tip && (
        <div className="rg-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
