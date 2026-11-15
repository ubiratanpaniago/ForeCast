import { useId, useMemo, useState } from "react";
import type { TrendResult } from "../../../types/geography";

interface Props {
  result: TrendResult;
  unit: string;
  decimals: number;
  significant: boolean;
}

const W = 560;
const H = 220;
const M = { top: 14, right: 14, bottom: 26, left: 46 };

/** Série anual com a reta de Theil-Sen do pipeline e o leque do IC 95 % da inclinação. */
export function TrendChart({ result, unit, decimals, significant }: Props) {
  const titleId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const { series, statistics: s, period } = result;
  const pts = series.filter((p): p is { year: number; value: number } => p.value !== null);

  const geo = useMemo(() => {
    const slope = s.slopePerDecade !== null ? s.slopePerDecade / 10 : null;
    // Intercepto de Sen: mediana de (y − b·t). Só posiciona a reta já estimada pelo pipeline.
    let line: null | ((y: number, b?: number) => number) = null;
    if (slope !== null && pts.length) {
      const mid = (period.start + period.end) / 2;
      const r = pts.map((p) => p.value - slope * (p.year - mid)).sort((a, b) => a - b);
      const k = Math.floor(r.length / 2);
      const a = r.length % 2 ? r[k] : (r[k - 1] + r[k]) / 2;
      line = (year, b = slope) => a + b * (year - mid);
    }
    const ci = s.confidenceInterval95;
    const ext = [
      ...pts.map((p) => p.value),
      ...(line ? [line(period.start), line(period.end)] : []),
      ...(line && ci ? [line(period.start, ci[0] / 10), line(period.end, ci[0] / 10), line(period.start, ci[1] / 10), line(period.end, ci[1] / 10)] : []),
    ];
    const lo = Math.min(...ext);
    const hi = Math.max(...ext);
    const pad = (hi - lo || 1) * 0.08;
    return { line, ci, yMin: Math.max(0, lo - pad), yMax: hi + pad };
  }, [s, pts, period]);

  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (yr: number) => M.left + ((yr - period.start) / (period.end - period.start)) * iw;
  const y = (v: number) => M.top + ih - ((v - geo.yMin) / (geo.yMax - geo.yMin || 1)) * ih;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
  const ticks = useMemo(() => {
    const span = geo.yMax - geo.yMin;
    const step = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((t) => span / t <= 4) ?? 1000;
    const out: number[] = [];
    for (let v = Math.ceil(geo.yMin / step) * step; v <= geo.yMax; v += step) out.push(+v.toFixed(4));
    return out;
  }, [geo]);

  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)} ${y(p.value).toFixed(1)}`).join("");
  const hv = hover !== null ? series.find((p) => p.year === hover) : null;

  return (
    <figure className="rg-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={titleId}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const yr = Math.round(period.start + (((e.clientX - r.left) / r.width) * W - M.left) / iw * (period.end - period.start));
          setHover(Math.min(period.end, Math.max(period.start, yr)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <title id={titleId}>Série anual {period.start}–{period.end} com reta de Theil-Sen</title>
        {ticks.map((v) => (
          <g key={v}>
            <line className="rg-grid" x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} />
            <text className="rg-tick" x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        {[period.start, 2006, 2012, 2018, period.end].map((yr) => (
          <text key={yr} className="rg-tick" x={x(yr)} y={H - 6} textAnchor="middle">
            {yr}
          </text>
        ))}
        {geo.line && geo.ci && (
          <polygon
            className="rg-fan"
            points={[
              [x(period.start), y(geo.line(period.start, geo.ci[0] / 10))],
              [x(period.end), y(geo.line(period.end, geo.ci[0] / 10))],
              [x(period.end), y(geo.line(period.end, geo.ci[1] / 10))],
              [x(period.start), y(geo.line(period.start, geo.ci[1] / 10))],
            ]
              .map((p) => p.join(","))
              .join(" ")}
          />
        )}
        <path className="rg-series" d={path} />
        {pts.map((p) => (
          <circle key={p.year} className="rg-dot" cx={x(p.year)} cy={y(p.value)} r={2.6} />
        ))}
        {geo.line && (
          <line
            className={`rg-sen ${significant ? "" : "is-ns"}`}
            x1={x(period.start)}
            y1={y(geo.line(period.start))}
            x2={x(period.end)}
            y2={y(geo.line(period.end))}
          />
        )}
        {hover !== null && <line className="rg-cross" x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} />}
      </svg>
      <figcaption className="rg-chart-cap">
        {hv ? (
          <span className="mono">
            {hv.year}: {hv.value === null ? "sem dado" : `${fmt(hv.value)} ${unit}`}
          </span>
        ) : (
          <>
            <span className="rg-key rg-key--series">valor anual</span>
            <span className={`rg-key rg-key--sen ${significant ? "" : "is-ns"}`}>Theil-Sen{significant ? "" : " (não significativa)"}</span>
            <span className="rg-key rg-key--fan">IC 95 % da inclinação</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
