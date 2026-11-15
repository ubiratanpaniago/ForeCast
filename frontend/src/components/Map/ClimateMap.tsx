import { useEffect, useRef, useState } from "react";
import {
  Map as LibreMap,
  NavigationControl,
  AttributionControl,
  setWorkerUrl,
  type GeoJSONSource,
  type Map as MapInstance,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(workerUrl);
import type {
  TrendResult,
  IndicatorId,
  LayerId,
  RegionsGeoJSON,
} from "../../types/geography";
import { valueColor, evidenceOf } from "./MapLayers";
import { MapControls } from "./MapControls";
import { RegionTooltip } from "./RegionTooltip";
import { annualColor } from "../../lib/annualColor";
const bounds: [[number, number], [number, number]] = [
  [-58, -34],
  [-47, -22],
];
interface Props {
  contextRegions?: RegionsGeoJSON | null;
  regions: RegionsGeoJSON | null;
  values: TrendResult[];
  indicator: IndicatorId;
  layer: LayerId;
  selectedRegionId: string | null;
  onRegionSelect: (id: string) => void;
  annualMaximum?: number;
}
export function ClimateMap({
  contextRegions,
  regions,
  values,
  indicator,
  layer,
  selectedRegionId,
  onRegionSelect,
  annualMaximum,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const onSelect = useRef(onRegionSelect);
  onSelect.current = onRegionSelect;
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [tooltip, setTooltip] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    if (!container.current) return;
    let instance: MapInstance;
    try {
      instance = new LibreMap({
        container: container.current,
        bounds,
        fitBoundsOptions: { padding: 42 },
        maxZoom: 12,
        minZoom: 3,
        attributionControl: false,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#151e1b" },
            },
          ],
        },
      });
    } catch {
      setMapError(
        "WebGL indisponível. Ative a aceleração gráfica do navegador para visualizar o mapa.",
      );
      return;
    }
    map.current = instance;
    instance.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right",
    );
    instance.addControl(
      new AttributionControl({
        customAttribution: "Limites: IBGE · malha simplificada",
        compact: false,
      }),
      "bottom-right",
    );
    instance.on("load", () => {
      instance.addSource("state-context", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addLayer({
        id: "state-context-fill",
        type: "fill",
        source: "state-context",
        paint: { "fill-color": "#26352d", "fill-opacity": 0.5 },
      });
      instance.addSource("regions", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "id",
      });
      instance.addLayer({
        id: "region-fill",
        type: "fill",
        source: "regions",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.84 },
      });
      instance.addLayer({
        id: "region-outline",
        type: "line",
        source: "regions",
        paint: {
          "line-color": "#c4cec4",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.12, 6, 0.4, 9, 0.8],
          "line-opacity": 0.65,
        },
      });
      instance.addLayer({
        id: "region-inconclusive",
        type: "line",
        source: "regions",
        filter: [
          "in",
          ["get", "evidence"],
          ["literal", ["inconclusive", "exploratory"]],
        ],
        paint: {
          "line-color": "#e4e9df",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
      instance.addLayer({
        id: "region-significant",
        type: "line",
        source: "regions",
        filter: ["==", ["get", "evidence"], "significant"],
        paint: { "line-color": "#e4e9df", "line-width": 2 },
      });
      instance.addLayer({
        id: "state-context-line",
        type: "line",
        source: "state-context",
        paint: { "line-color": "#8a9b81", "line-width": 1.3 },
      });
      instance.addLayer({
        id: "region-selected",
        type: "line",
        source: "regions",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#d0f78a", "line-width": 3 },
      });
      instance.on("click", "region-fill", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelect.current(String(id));
      });
      instance.on("mousemove", "region-fill", (e) => {
        instance.getCanvas().style.cursor = "pointer";
        setTooltip({
          name: String(e.features?.[0]?.properties?.name ?? ""),
          x: e.point.x,
          y: e.point.y,
        });
      });
      instance.on("mouseleave", "region-fill", () => {
        instance.getCanvas().style.cursor = "";
        setTooltip(null);
      });
      instance.on("movestart", () => setTooltip(null));
      setReady(true);
    });
    instance.on("error", (event) =>
      setMapError(
        `Não foi possível renderizar uma camada cartográfica: ${event.error.message}`,
      ),
    );
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      setReady(false);
    };
  }, []);
  useEffect(() => {
    if (ready)
      (
        map.current?.getSource("state-context") as GeoJSONSource | undefined
      )?.setData(contextRegions ?? { type: "FeatureCollection", features: [] });
  }, [ready, contextRegions]);
  useEffect(() => {
    if (!ready) return;
    const valuesById = new Map(values.map((value) => [value.regionId, value]));
    const data = {
      type: "FeatureCollection" as const,
      features: (regions?.features ?? []).map((feature) => {
        const value = valuesById.get(feature.properties.id);
        return {
          ...feature,
          properties: {
            ...feature.properties,
            color: annualMaximum ? annualColor(feature.properties.annualValue, annualMaximum) : valueColor(layer, value, indicator),
            evidence: annualMaximum || layer === "neutral" ? "missing" : evidenceOf(value),
          },
        };
      }),
    };
    (map.current?.getSource("regions") as GeoJSONSource | undefined)?.setData(
      data,
    );
  }, [ready, regions, values, layer, indicator, annualMaximum]);
  useEffect(() => {
    if (ready)
      map.current?.setFilter("region-selected", [
        "==",
        ["get", "id"],
        selectedRegionId ?? "",
      ]);
  }, [ready, selectedRegionId]);
  return (
    <div className="map-stage">
      <div
        ref={container}
        className="map-canvas"
        role="region"
        aria-label="Mapa de células das grades nativas da NASA; limites estaduais como contexto"
      />
      <div className="map-caption">
        <span className="status-dot" /> SUL DO BRASIL{" "}
        <small>PR / SC / RS</small>
      </div>
      <div className="map-orientation" aria-hidden="true">
        N<br />↑
      </div>
      <div className="ocean-label" aria-hidden="true">
        OCEANO
        <br />
        ATLÂNTICO
      </div>
      <MapControls
        onReset={() =>
          map.current?.fitBounds(bounds, {
            padding: 42,
            duration: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? 0
              : 700,
          })
        }
      />
      {tooltip && <RegionTooltip {...tooltip} />}
      {mapError && (
        <div className="map-error" role="alert">
          {mapError}
        </div>
      )}
      <div className="map-bottom-note">
        PROJEÇÃO MERCATOR <span>WGS 84 / EPSG:3857</span>
      </div>
    </div>
  );
}
