import { useMemo, useState } from "react";
import type { MonthlyPoint, SeriesKey, Snapshot } from "../../types/climate";
import { useWidth } from "../../hooks/useWidth";
import { monthLabel } from "../../lib/format";
import { useLanguage } from "../../../../i18n/LanguageContext";

interface Props {
  data: Snapshot;
  series: SeriesKey;
  onSeriesChange: (s: SeriesKey) => void;
  year: number;
  onSelectYear: (y: number) => void;
}

const SERIES: Record<
  SeriesKey,
  { label: string; unit: string; decimals: number }
> = {
  precipitation: { label: "Precipitação", unit: "mm/mês", decimals: 0 },
  soilMoisture: {
    label: "Umidade do solo 0–10 cm",
    unit: "kg m⁻²",
    decimals: 1,
  },
};

const H = 300;
const M = { top: 16, right: 16, bottom: 30, left: 48 };

function rolling(points: (MonthlyPoint | undefined)[], n = 12) {
  return points.map((_, i) => {
    if (i < n - 1) return null;
    const win = points.slice(i - n + 1, i + 1);
    if (win.some((p) => !p)) return null;
    return win.reduce((s, p) => s + p!.v, 0) / n;
  });
}

export default function HistoricalChart({
  data,
  series,
  onSeriesChange,
  year,
  onSelectYear,
}: Props) {
  const { language, t } = useLanguage();
  const locale = language === "pt" ? "pt-BR" : "en-US";
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const cfg = SERIES[series];
  const y0 = data.years[0];
  const nMonths = data.years.length * 12;

  const { slots, roll, yMin, yMax, coverage } = useMemo(() => {
    const slots: (MonthlyPoint | undefined)[] = new Array(nMonths);
    for (const p of data.monthly[series]) {
      const [y, m] = p.t.split("-").map(Number);
      const k = (y - y0) * 12 + (m - 1);
      if (k >= 0 && k < nMonths) slots[k] = p;
    }
    const vals = data.monthly[series].map((p) => p.v);
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 1;
    const pad = Math.max((hi - lo) * 0.08, 1);
    return {
      slots,
      roll: rolling(slots),
      yMin: series === "precipitation" ? 0 : Math.floor(lo - pad),
      yMax: Math.ceil(hi + pad),
      coverage: vals.length,
    };
  }, [data, series, y0, nMonths]);

  const iw = Math.max(200, width - M.left - M.right);
  const ih = H - M.top - M.bottom;
  const x = (k: number) => M.left + (k / (nMonths - 1)) * iw;
  const y = (v: number) => M.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

  const path = (vals: (number | null | undefined)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, k) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(k).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const ticksY = useMemo(() => {
    const span = yMax - yMin;
    const step =
      [1, 2, 5, 10, 20, 25, 50, 100, 200].find((s) => span / s <= 5) ?? 100;
    const out: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step)
      out.push(v);
    return out;
  }, [yMin, yMax]);

  const kFromEvent = (
    e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
  ) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = Math.round(((e.clientX - r.left - M.left) / iw) * (nMonths - 1));
    return Math.min(nMonths - 1, Math.max(0, k));
  };

  const yi = year - y0;
  const hp = hover != null ? slots[hover] : undefined;
  const hoverT =
    hover != null
      ? `${y0 + Math.floor(hover / 12)}-${String((hover % 12) + 1).padStart(2, "0")}`
      : "";

  return (
    <div className="chart">
      <div className="chart-head">
        <div className="seg" role="tablist" aria-label={t("Variável")}>
          {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={series === k}
              className="seg-btn"
              onClick={() => onSeriesChange(k)}
            >
              {t(SERIES[k].label)}
            </button>
          ))}
        </div>
        <div className="chart-key">
          <span className="key key--line">{t("mensal")}</span>
          <span className="key key--roll">{t("média móvel 12 meses")}</span>
          <span className="mono muted">{cfg.unit}</span>
        </div>
      </div>
      {coverage < nMonths && (
        <p className="chart-note">
          {t("Cobertura parcial: {coverage} de {expected} meses presentes no snapshot. Os vazios são falta de dados, não zeros.").replace("{coverage}", coverage.toLocaleString(locale)).replace("{expected}", nMonths.toLocaleString(locale))}
        </p>
      )}
      <div ref={ref} className="chart-body">
        <svg
          width={width}
          height={H}
          onPointerMove={(e) => setHover(kFromEvent(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onSelectYear(y0 + Math.floor(kFromEvent(e) / 12))}
          role="img"
          aria-label={t("{label} mensal, {start}–{end}").replace("{label}", t(cfg.label)).replace("{start}", String(y0)).replace("{end}", String(data.years[data.years.length - 1]))}
        >
          <rect
            className="chart-sel"
            x={x(yi * 12) - 2}
            y={M.top}
            width={x(yi * 12 + 11) - x(yi * 12) + 4}
            height={ih}
          />
          {ticksY.map((v) => (
            <g key={v}>
              <line
                className="chart-grid"
                x1={M.left}
                x2={M.left + iw}
                y1={y(v)}
                y2={y(v)}
              />
              <text
                className="chart-tick"
                x={M.left - 8}
                y={y(v)}
                dy="0.32em"
                textAnchor="end"
              >
                {v}
              </text>
            </g>
          ))}
          {data.years.map((yr, i) =>
            i % (width < 640 ? 4 : 2) === 0 ? (
              <text key={yr} className="chart-tick" x={x(i * 12)} y={H - 8}>
                {yr}
              </text>
            ) : null,
          )}
          <path className="chart-line" d={path(slots.map((p) => p?.v))} />
          <path className="chart-roll" d={path(roll)} />
          {hover != null && (
            <g>
              <line
                className="chart-cross"
                x1={x(hover)}
                x2={x(hover)}
                y1={M.top}
                y2={M.top + ih}
              />
              {hp && (
                <circle
                  className="chart-dot"
                  cx={x(hover)}
                  cy={y(hp.v)}
                  r={3.5}
                />
              )}
            </g>
          )}
        </svg>
        {hover != null && (
          <div
            className="chart-tip"
            style={{ left: Math.min(x(hover) + 12, width - 160), top: M.top }}
          >
            <span className="mono">{monthLabel(hoverT, language)}</span>
            <strong>
              {hp
                ? `${hp.v.toLocaleString(locale, { minimumFractionDigits: cfg.decimals, maximumFractionDigits: cfg.decimals })} ${cfg.unit}`
                : t("sem dado")}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}
