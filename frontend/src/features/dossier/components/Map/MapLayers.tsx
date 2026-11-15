import { useMemo } from "react";
import type { CellReading, MapMode, Snapshot } from "../../types/climate";
import {
  ANOMALY_RANGE,
  ANOMALY_STOPS,
  TOTAL_RANGE,
  TOTAL_STOPS,
} from "../../lib/color";

type BBox = Snapshot["meta"]["bbox"];

/** Contorno terra/oceano derivado das células válidas do GLDAS (0,25°). */
export function Coastline({ mask }: { mask: Snapshot["landMask"] }) {
  const d = useMemo(() => {
    const h = mask.res / 2;
    const isLand = (i: number, j: number) => mask.rows[i]?.[j] === "1";
    const segs: string[] = [];
    mask.lat.forEach((lat, i) =>
      mask.lon.forEach((lon, j) => {
        if (!isLand(i, j)) return;
        const y0 = -(lat - h),
          y1 = -(lat + h),
          x0 = lon - h,
          x1 = lon + h;
        if (j + 1 < mask.lon.length && !isLand(i, j + 1))
          segs.push(`M${x1} ${y0}V${y1}`);
        if (j > 0 && !isLand(i, j - 1)) segs.push(`M${x0} ${y0}V${y1}`);
        if (i + 1 < mask.lat.length && !isLand(i + 1, j))
          segs.push(`M${x0} ${y1}H${x1}`);
        if (i > 0 && !isLand(i - 1, j)) segs.push(`M${x0} ${y0}H${x1}`);
      }),
    );
    return segs.join("");
  }, [mask]);
  return <path className="map-coast" d={d} vectorEffect="non-scaling-stroke" />;
}

export function Graticule({ bbox, step = 2 }: { bbox: BBox; step?: number }) {
  const lons: number[] = [];
  const lats: number[] = [];
  for (let x = Math.ceil(bbox.west / step) * step; x <= bbox.east; x += step)
    lons.push(x);
  for (let y = Math.ceil(bbox.south / step) * step; y <= bbox.north; y += step)
    lats.push(y);
  return (
    <g className="map-graticule">
      {lons.map((x) => (
        <line
          key={`x${x}`}
          x1={x}
          x2={x}
          y1={-bbox.north}
          y2={-bbox.south}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {lats.map((y) => (
        <line
          key={`y${y}`}
          x1={bbox.west}
          x2={bbox.east}
          y1={-y}
          y2={-y}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

export function HoverMarker({
  cell,
  res,
}: {
  cell: CellReading | null;
  res: number;
}) {
  if (!cell) return null;
  const h = res / 2;
  return (
    <rect
      className="map-hover"
      x={cell.lon - h}
      y={-(cell.lat + h)}
      width={res}
      height={res}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** Rótulos de grade posicionados em % fora do quadro do mapa. */
export function GraticuleLabels({
  bbox,
  step = 2,
}: {
  bbox: BBox;
  step?: number;
}) {
  const w = bbox.east - bbox.west;
  const h = bbox.north - bbox.south;
  const lons: number[] = [];
  const lats: number[] = [];
  for (let x = Math.ceil(bbox.west / step) * step; x <= bbox.east; x += step)
    lons.push(x);
  for (let y = Math.ceil(bbox.south / step) * step; y <= bbox.north; y += step)
    lats.push(y);
  return (
    <>
      {lons.map((x) => (
        <span
          key={`lx${x}`}
          className="map-tick map-tick--lon"
          style={{ left: `${((x - bbox.west) / w) * 100}%` }}
        >
          {Math.abs(x)}°W
        </span>
      ))}
      {lats.map((y) => (
        <span
          key={`ly${y}`}
          className="map-tick map-tick--lat"
          style={{ top: `${((bbox.north - y) / h) * 100}%` }}
        >
          {Math.abs(y)}°S
        </span>
      ))}
    </>
  );
}

export function Legend({ mode }: { mode: MapMode }) {
  const stops = mode === "anomaly" ? ANOMALY_STOPS : TOTAL_STOPS;
  const labels =
    mode === "anomaly"
      ? [`−${ANOMALY_RANGE}%`, "média", `+${ANOMALY_RANGE}%`]
      : [
          `${TOTAL_RANGE[0]} mm`,
          `${(TOTAL_RANGE[0] + TOTAL_RANGE[1]) / 2} mm`,
          `${TOTAL_RANGE[1]} mm`,
        ];
  return (
    <div className="legend">
      <div
        className="legend-bar"
        style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }}
      />
      <div className="legend-labels">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="legend-ocean">
        <span className="legend-swatch" /> fora da máscara de validade GLDAS
        (não é limite estadual)
      </div>
    </div>
  );
}
