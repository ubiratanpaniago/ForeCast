import type { Crossing, InfrastructureCatalog, RoadSegment, TerrainClass } from "../../../services/regionApi";
import { useLanguage } from "../../../i18n/LanguageContext";

const CLASS_UI: Array<{ key: TerrainClass; label: string; color: string }> = [
  { key: "alta", label: "Alta", color: "#4a7c8c" },
  { key: "media", label: "Média", color: "#9bbcc4" },
  { key: "baixa", label: "Baixa", color: "#e4ddcd" },
  { key: "sem_dado", label: "Sem dado", color: "#c9c2b3" },
];

interface Props {
  segment: RoadSegment;
  crossings: Crossing[];
  selectedCrossing: string | null;
  catalog: InfrastructureCatalog | null;
  onCrossing: (c: Crossing) => void;
  onClose: () => void;
}

/** Trecho rodoviário: extensão por classe de suscetibilidade e travessias candidatas. */
export function SegmentPanel({ segment: s, crossings, selectedCrossing, catalog, onCrossing, onClose }: Props) {
  const { t, language } = useLanguage();
  const locale = language === "en" ? "en-US" : "pt-BR";
  const km = (v: number) => `${v.toLocaleString(locale, { maximumFractionDigits: v < 10 ? 1 : 0 })} km`;
  const pct = (v: number) => `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 0 })}%`;
  const total = s.lengthKm || 1;
  const sorted = [...crossings].sort((a, b) => b.lengthKm - a.lengthKm);
  return (
    <section className="rg-panel" aria-label={`${t("Trecho")} ${s.ref}`}>
      <header className="rg-panel-head">
        <div>
          <p className="eyebrow">
            {t("Rodovia")} {t(s.jurisdiction)} · {s.uf} · {s.regionName}
          </p>
          <h2>{s.ref}</h2>
          {s.refs.length > 1 && <p className="muted rg-small">{t("Também")}: {s.refs.filter((r) => r !== s.ref).join(", ")}</p>}
        </div>
        <button className="rg-x" onClick={onClose} aria-label={t("Fechar trecho")}>
          ×
        </button>
      </header>

      <div className="rg-situation rg-situation--exploratory">
        <p className="rg-situation-text">
          {km(s.lengthByClassKm.alta)} ({pct(s.lengthByClassKm.alta / total)}) {t("do trecho passam por células de suscetibilidade alta.")}
        </p>
        <p className="muted">{t("Diagnóstico exploratório de exposição do relevo. Não é risco de interdição.")}</p>
      </div>

      <h3 className="rg-h">{t("Extensão por classe do relevo")}</h3>
      <div className="rg-stack" role="img" aria-label={t("Distribuição da extensão por classe de suscetibilidade")}>
        {CLASS_UI.map((c) =>
          s.lengthByClassKm[c.key] > 0 ? (
            <span key={c.key} style={{ width: `${(s.lengthByClassKm[c.key] / total) * 100}%`, background: c.color }} />
          ) : null,
        )}
      </div>
      <table className="rg-table rg-table--compact">
        <tbody>
          {CLASS_UI.map((c) => (
            <tr key={c.key}>
              <th scope="row">
                <i className="rg-sw" style={{ background: c.color }} aria-hidden /> {t(c.label)}
              </th>
              <td className="mono">{km(s.lengthByClassKm[c.key])}</td>
              <td className="mono muted">{pct(s.lengthByClassKm[c.key] / total)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">{t("Total")}</th>
            <td className="mono">{km(s.lengthKm)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <h3 className="rg-h">{t("Travessias candidatas")} ({crossings.length})</h3>
      {sorted.length ? (
        <ol className="rg-crossings">
          {sorted.map((c) => (
            <li key={c.id}>
              <button className={`rg-crossing ${c.id === selectedCrossing ? "is-on" : ""}`} onClick={() => onCrossing(c)}>
                <span className="mono">{km(c.lengthKm)}</span> {t("em célula com")}{" "}
                {c.susceptibleFraction !== null ? pct(c.susceptibleFraction) : "—"} {t("de planície baixa")}
                <span className="muted mono rg-small">
                  {" "}
                  · {c.elevationMeanM !== null ? `${Math.round(c.elevationMeanM)} m` : "—"} ·{" "}
                  {c.slopeMeanDeg !== null ? `${c.slopeMeanDeg.toLocaleString(locale, { maximumFractionDigits: 1 })}°` : "—"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">{t("Nenhuma passagem de")} {catalog?.parameters.minCrossingKm ?? 0.5} km {t("ou mais por célula de classe alta.")}</p>
      )}

      <details className="rg-details" open>
        <summary>{t("Como foi calculado e limitações")}</summary>
        <p>
          {t("Rodovia dividida em pedaços de")} {((catalog?.parameters.stepKm ?? 0.1) * 1000).toLocaleString(locale, { maximumFractionDigits: 0 })} m; {t("cada pedaço recebe a classe da célula de 0,1° do relevo onde cai. Travessia candidata: ao menos")} {catalog?.parameters.minCrossingKm ?? 0.5} km {t("dentro de uma célula de classe alta.")}
        </p>
        <ul>{catalog?.limitations.map((l) => <li key={l}>{t(l)}</li>)}</ul>
      </details>
    </section>
  );
}
