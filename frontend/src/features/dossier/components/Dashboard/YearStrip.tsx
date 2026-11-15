import type { Snapshot } from "../../types/climate";
import { anomalyColor, css } from "../../lib/color";
import { anomalyPct } from "../../hooks/useRegionData";
import { pct } from "../../lib/format";

interface Props {
  data: Snapshot;
  year: number;
  onSelect: (y: number) => void;
}

/** Uma barra por ano: altura e cor = anomalia regional do total anual. */
export default function YearStrip({ data, year, onSelect }: Props) {
  const { regional, regionalClimatology } = data.annual;
  const max = Math.max(
    ...data.years.map((y) =>
      Math.abs(anomalyPct(regional[y], regionalClimatology)),
    ),
  );

  const onKey = (e: React.KeyboardEvent) => {
    const i = data.years.indexOf(year);
    const next =
      e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
    if (next >= 0 && next < data.years.length) {
      e.preventDefault();
      onSelect(data.years[next]);
      (
        e.currentTarget.querySelectorAll("button")[next] as
          HTMLButtonElement | undefined
      )?.focus();
    }
  };

  return (
    <div className="strip" role="radiogroup" aria-label="Ano" onKeyDown={onKey}>
      {data.years.map((y) => {
        const a = anomalyPct(regional[y], regionalClimatology);
        const h = (Math.abs(a) / (max || 1)) * 48;
        return (
          <button
            key={y}
            role="radio"
            aria-checked={y === year}
            tabIndex={y === year ? 0 : -1}
            className="strip-year"
            onClick={() => onSelect(y)}
            aria-label={`${y}: ${pct(a)}`}
            title={`${y}: ${pct(a)}`}
          >
            <span className="strip-plot">
              <span
                className="strip-bar"
                style={{
                  background: css(anomalyColor(a * 1.6)),
                  height: `${Math.max(h, 1.5)}%`,
                  ...(a >= 0 ? { bottom: "50%" } : { top: "50%" }),
                }}
              />
            </span>
            <span className="strip-label">{String(y).slice(2)}</span>
          </button>
        );
      })}
    </div>
  );
}
