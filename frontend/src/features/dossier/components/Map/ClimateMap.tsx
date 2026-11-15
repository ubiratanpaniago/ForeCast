import { useEffect, useRef, useState } from "react";
import { SouthContext } from "./SouthContext";
import type { CellReading, MapMode, Snapshot } from "../../types/climate";
import { anomalyColor, totalColor } from "../../lib/color";
import { anomalyPct } from "../../hooks/useRegionData";
import {
  Coastline,
  Graticule,
  GraticuleLabels,
  HoverMarker,
} from "./MapLayers";

interface Props {
  data: Snapshot;
  land: boolean[];
  year: number;
  mode: MapMode;
  hovered: CellReading | null;
  onHover: (ij: [number, number] | null) => void;
  onSelect: (ij: [number, number]) => void;
}

const MID_LAT = (-34 + -22) / 2;

export default function ClimateMap({
  data,
  land,
  year,
  mode,
  hovered,
  onHover,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [highlightSouth, setHighlightSouth] = useState(true);
  const { grid, meta } = data;
  const { bbox } = meta;
  const nlat = grid.lat.length;
  const nlon = grid.lon.length;
  const aspect =
    ((bbox.east - bbox.west) * Math.cos((MID_LAT * Math.PI) / 180)) /
    (bbox.north - bbox.south);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(nlon, nlat);
    const totals = data.annual.byYear[year];
    const clim = data.annual.climatology;
    for (let i = 0; i < nlat; i++) {
      for (let j = 0; j < nlon; j++) {
        const idx = i * nlon + j;
        const rgb =
          mode === "anomaly"
            ? anomalyColor(anomalyPct(totals[idx], clim[idx]))
            : totalColor(totals[idx]);
        const p = ((nlat - 1 - i) * nlon + j) * 4;
        img.data[p] = rgb[0];
        img.data[p + 1] = rgb[1];
        img.data[p + 2] = rgb[2];
        img.data[p + 3] = land[idx] ? 255 : 70;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [data, land, year, mode, nlat, nlon]);

  const indexFromEvent = (
    e: React.PointerEvent<HTMLDivElement>,
  ): [number, number] | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const lon =
      bbox.west + ((e.clientX - r.left) / r.width) * (bbox.east - bbox.west);
    const lat =
      bbox.north - ((e.clientY - r.top) / r.height) * (bbox.north - bbox.south);
    const i = Math.floor((lat - bbox.south) / grid.res);
    const j = Math.floor((lon - bbox.west) / grid.res);
    if (i < 0 || j < 0 || i >= nlat || j >= nlon) return null;
    return [i, j];
  };

  return (
    <div className="map-frame">
      <div className="map-focus-controls">
        <button
          onClick={() => setHighlightSouth((v) => !v)}
          aria-pressed={highlightSouth}
        >
          {highlightSouth ? "Sul em destaque" : "Recorte completo"}
        </button>
        <span>Limites estaduais · IBGE</span>
      </div>
      <div
        className="map"
        style={{ aspectRatio: String(aspect), maxWidth: `${aspect * 80}dvh` }}
        onPointerMove={(e) => onHover(indexFromEvent(e))}
        onPointerDown={(e) => {
          const index = indexFromEvent(e);
          if (index) onSelect(index);
        }}
        onPointerLeave={() => onHover(null)}
        role="group"
        tabIndex={0}
        onKeyDown={(e) => {
          let i = hovered
            ? grid.lat.indexOf(hovered.lat)
            : Math.floor(nlat / 2);
          let j = hovered
            ? grid.lon.indexOf(hovered.lon)
            : Math.floor(nlon / 2);
          if (e.key === "Enter") {
            e.preventDefault();
            onSelect([i, j]);
            return;
          }
          if (
            !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
          )
            return;
          e.preventDefault();
          if (e.key === "ArrowUp") i++;
          if (e.key === "ArrowDown") i--;
          if (e.key === "ArrowLeft") j--;
          if (e.key === "ArrowRight") j++;
          onHover([
            Math.max(0, Math.min(nlat - 1, i)),
            Math.max(0, Math.min(nlon - 1, j)),
          ]);
        }}
        aria-label={`Mapa agregado de ${mode === "anomaly" ? "anomalia" : "total"} de precipitação em ${year}. Use as setas para explorar e Enter para fixar.`}
      >
        <canvas
          ref={canvasRef}
          width={nlon}
          height={nlat}
          className="map-raster"
        />
        <svg
          className="map-overlay"
          viewBox={`${bbox.west} ${-bbox.north} ${bbox.east - bbox.west} ${bbox.north - bbox.south}`}
          preserveAspectRatio="none"
        >
          <Graticule bbox={bbox} />
          <Coastline mask={data.landMask} />
          <SouthContext bbox={bbox} highlight={highlightSouth} />
          <HoverMarker cell={hovered} res={grid.res} />
        </svg>
        <GraticuleLabels bbox={bbox} />
      </div>
      <p className="map-focus-note">
        Destaque visual de PR, SC e RS. Os valores e as médias continuam
        referentes ao recorte original do snapshot.
      </p>
    </div>
  );
}
