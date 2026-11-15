import { useEffect, useId, useState } from "react";
import type { RegionsGeoJSON } from "../../../../types/geography";
import type { Snapshot } from "../../types/climate";

export function SouthContext({
  bbox,
  highlight,
}: {
  bbox: Snapshot["meta"]["bbox"];
  highlight: boolean;
}) {
  const [regions, setRegions] = useState<RegionsGeoJSON | null>(null);
  const [failed, setFailed] = useState(false);
  const maskId = useId().replace(/:/g, "");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/south-regions.geojson", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setRegions(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  if (!regions)
    return failed ? (
      <text
        x={bbox.west + 0.3}
        y={-bbox.north + 0.4}
        className="state-load-error"
      >
        Limites IBGE indisponíveis
      </text>
    ) : null;
  const paths = regions.features.map((feature) => {
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    const d = polygons
      .flatMap((p) =>
        p.map(
          (r) =>
            r
              .map(([lon, lat], i) => `${i ? "L" : "M"}${lon} ${-lat}`)
              .join("") + "Z",
        ),
      )
      .join("");
    return { id: feature.properties.id, d };
  });
  return (
    <g className="south-context" pointerEvents="none">
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={bbox.west}
          y={-bbox.north}
          width={bbox.east - bbox.west}
          height={bbox.north - bbox.south}
        >
          <rect
            x={bbox.west}
            y={-bbox.north}
            width={bbox.east - bbox.west}
            height={bbox.north - bbox.south}
            fill="white"
          />
          {paths.map((p) => (
            <path key={p.id} d={p.d} fill="black" fillRule="evenodd" />
          ))}
        </mask>
      </defs>
      {highlight && (
        <rect
          className="outside-south"
          x={bbox.west}
          y={-bbox.north}
          width={bbox.east - bbox.west}
          height={bbox.north - bbox.south}
          mask={`url(#${maskId})`}
        />
      )}
      {paths.map((p) => (
        <g key={p.id}>
          <path
            d={p.d}
            className="state-outline-halo"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={p.d}
            className="state-outline"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {[
        { label: "PARANÁ", x: -51.7, y: 24.65 },
        { label: "SANTA CATARINA", x: -50.5, y: 27.05 },
        { label: "RIO GRANDE DO SUL", x: -53, y: 30.1 },
      ].map((p) => (
        <text
          key={p.label}
          x={p.x}
          y={p.y}
          className="state-label"
          textAnchor="middle"
        >
          {p.label}
        </text>
      ))}
    </g>
  );
}
