import { useState } from "react";
import type { Snapshot } from "../../types/climate";
import { compareYears } from "../../lib/comparison";
import { mm, pct, coord } from "../../lib/format";
import { useLanguage } from "../../../../i18n/LanguageContext";
export function YearComparison({
  data,
  year,
  onSelectYear,
  block,
}: {
  data: Snapshot;
  year: number;
  onSelectYear: (y: number) => void;
  block: [number, number] | null;
}) {
  const { language, t } = useLanguage();
  const fmt = (v: number | null, percent = false) =>
    v === null ? t("Indisponível") : percent ? pct(v, language) : mm(v, language);
  const [reference, setReference] = useState(data.years[0]);
  const [scope, setScope] = useState("region");
  const activeBlock = scope === "block" ? block : null;
  const values = compareYears(data, year, reference, activeBlock);
  const monthly = (y: number) =>
    Array.from(
      { length: 12 },
      (_, i) =>
        data.monthly.precipitation.find(
          (p) => p.t === `${y}-${String(i + 1).padStart(2, "0")}`,
        )?.v ?? null,
    );
  const current = monthly(year),
    baseline = monthly(reference);
  const max = Math.max(
    1,
    ...current.filter((v) => v !== null),
    ...baseline.filter((v) => v !== null),
  );
  const names = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, i, 1))).replace(".", ""));
  return (
    <section className="exhibit comparison" aria-label={t("Comparação entre anos")}>
      <div className="exhibit-head">
        <p className="exhibit-tag">{t("Comparar")}</p>
        <h2>{t("Dois anos, a mesma referência.")}</h2>
      </div>
      <div className="comparison-filters">
        <label>
          {t("Ano em análise")}
          <select
            value={year}
            onChange={(e) => onSelectYear(Number(e.target.value))}
          >
            {data.years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Ano de comparação")}
          <select
            value={reference}
            onChange={(e) => setReference(Number(e.target.value))}
          >
            {data.years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Área comparada")}
          <select
            value={block ? scope : "region"}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="region">{t("Recorte BBOX / terra")}</option>
            <option value="block" disabled={!block}>
              {t("Bloco fixado no mapa")}
            </option>
          </select>
        </label>
      </div>
      <p className="comparison-context">
        {activeBlock
          ? t("Bloco agregado {resolution}°: {lat} / {lon}.").replace("{resolution}", String(data.grid.res)).replace("{lat}", coord(data.grid.lat[activeBlock[0]], "N", "S", language)).replace("{lon}", coord(data.grid.lon[activeBlock[1]], language === "pt" ? "L" : "E", language === "pt" ? "O" : "W", language))
          : t("Média espacial do total anual no recorte terrestre do BBOX, sem máscara estadual.")}{" "}
        {t("Os dois anos usam a mesma área. Anomalias usam a climatologia {start}–{end}.").replace("{start}", String(data.years[0])).replace("{end}", String(data.years.at(-1)))}
      </p>
      <div className="comparison-metrics">
        <div>
          <span>{year} · {t("total anual")}</span>
          <strong>{fmt(values.current)}</strong>
          <small>{t("Anomalia:")} {fmt(values.currentAnomaly, true)}</small>
        </div>
        <div>
          <span>{reference} · {t("total anual")}</span>
          <strong>{fmt(values.reference)}</strong>
          <small>{t("Anomalia:")} {fmt(values.referenceAnomaly, true)}</small>
        </div>
        <div>
          <span>
            {t("Diferença · {year} menos {reference}").replace("{year}", String(year)).replace("{reference}", String(reference))}
          </span>
          <strong>{fmt(values.delta)}</strong>
          <small>
            {values.percent === null
              ? t("Variação relativa indisponível")
              : t("{percent} em relação a {year}").replace("{percent}", pct(values.percent, language)).replace("{year}", String(reference))}
          </small>
        </div>
      </div>
      {year === reference && (
        <p className="chart-note">
          {t("O mesmo ano está nos dois lados; a diferença é zero.")}
        </p>
      )}
      {activeBlock ? (
        <p className="chart-note">
          {t("Este snapshot tem somente totais anuais por bloco. A série mensal é regional; não será apresentada como série deste bloco.")}
        </p>
      ) : (
        <>
          <div className="comparison-chart-key">
            <span className="comparison-key-a">{year}</span>
            <span className="comparison-key-b">{reference}</span>
            <span>{t("Precipitação mensal · mm · escala compartilhada")}</span>
          </div>
          <svg
            className="comparison-bars"
            viewBox="0 0 720 230"
            role="img"
            aria-label={t("Comparação de precipitação mensal entre {year} e {reference}; valores na tabela abaixo").replace("{year}", String(year)).replace("{reference}", String(reference))}
          >
            <line x1="30" x2="710" y1="195" y2="195" stroke="var(--rule)" />
            <text x="5" y="16" className="chart-tick">
              {Math.ceil(max)} mm
            </text>
            {names.map((name, i) => {
              const x = 36 + i * 56;
              return (
                <g key={name}>
                  {[current[i], baseline[i]].map((v, j) =>
                    v === null ? null : (
                      <rect
                        key={j}
                        x={x + j * 20}
                        y={195 - (v / max) * 160}
                        width="17"
                        height={(v / max) * 160}
                        fill={j ? "var(--muted)" : "var(--accent)"}
                      >
                        <title>
                          {j ? reference : year} · {name}: {mm(v, language)}
                        </title>
                      </rect>
                    ),
                  )}
                  <text
                    x={x + 18}
                    y="218"
                    textAnchor="middle"
                    className="chart-tick"
                  >
                    {name}
                  </text>
                </g>
              );
            })}
          </svg>
          <details className="comparison-table">
            <summary>{t("Ver os valores mensais em tabela")}</summary>
            <table>
              <caption>{t("Precipitação mensal do recorte, em mm")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Mês")}</th>
                  <th scope="col">{year}</th>
                  <th scope="col">{reference}</th>
                </tr>
              </thead>
              <tbody>
                {names.map((name, i) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{fmt(current[i])}</td>
                    <td>{fmt(baseline[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
      <p className="muted">
        {t("Comparação descritiva de dois anos. Não estima tendência, significância estatística ou risco de inundação.")}
      </p>
    </section>
  );
}
