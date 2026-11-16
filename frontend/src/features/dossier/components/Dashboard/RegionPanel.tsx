import type { CellReading, Snapshot, YearSummary } from "../../types/climate";
import { coord, mm, monthLabel, pct } from "../../lib/format";
import { useLanguage } from "../../../../i18n/LanguageContext";

interface Props {
  data: Snapshot;
  summary: YearSummary;
  cell: CellReading | null;
}

export default function RegionPanel({ data, summary, cell }: Props) {
  const { language, t } = useLanguage();
  const n = data.years.length;
  const wet = summary.anomalyPct >= 0;
  const rankText =
    summary.rankDry <= n / 2
      ? t("{rank}º mais seco de {count}").replace("{rank}", String(summary.rankDry)).replace("{count}", String(n))
      : t("{rank}º mais chuvoso de {count}").replace("{rank}", String(n - summary.rankDry + 1)).replace("{count}", String(n));

  return (
    <aside className="panel">
      <p className="eyebrow">{t("Resumo do recorte · {year}").replace("{year}", String(summary.year))}</p>
      <p className={`verdict ${wet ? "is-wet" : "is-dry"}`}>
        {pct(summary.anomalyPct, language)}
      </p>
      <p className="verdict-sub">
        {t("em relação à média 2001–2024 de")} {" "}
        <span className="mono">{mm(data.annual.regionalClimatology, language)}</span>
      </p>

      <dl className="facts">
        <div>
          <dt>{t("Média do total anual (BBOX/terra)")}</dt>
          <dd className="mono">{mm(summary.total, language)}</dd>
        </div>
        <div>
          <dt>{t("Posição na série")}</dt>
          <dd className="mono">{rankText}</dd>
        </div>
        <div>
          <dt>{t("Mês mais chuvoso")}</dt>
          <dd className="mono">
            {monthLabel(summary.wettestMonth.t, language)} · {mm(summary.wettestMonth.v, language)}
          </dd>
        </div>
        <div>
          <dt>{t("Mês mais seco")}</dt>
          <dd className="mono">
            {monthLabel(summary.driestMonth.t, language)} · {mm(summary.driestMonth.v, language)}
          </dd>
        </div>
        <div>
          <dt>{t("Umidade 0–10 cm · média dos meses disponíveis")}</dt>
          <dd className="mono">
            {summary.soilMean != null
              ? `${summary.soilMean.toLocaleString(language === "pt" ? "pt-BR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg m⁻² (${summary.soilMonths}/12 ${t("meses")})`
              : t("sem dados neste snapshot")}
          </dd>
        </div>
      </dl>

      <div className={`probe ${cell ? "is-active" : ""}`} aria-live="polite">
        <p className="eyebrow">{t("Sonda · bloco agregado 0,2°")}</p>
        {cell ? (
          <>
            <p className="mono probe-coord">
              {coord(cell.lat, "N", "S", language)} {coord(cell.lon, language === "pt" ? "L" : "E", language === "pt" ? "O" : "W", language)}
              {!cell.land && <span className="tag">{t("fora da máscara GLDAS")}</span>}
            </p>
            <dl className="probe-grid">
              <dt>{summary.year}</dt>
              <dd className="mono">{mm(cell.total, language)}</dd>
              <dt>{t("média")}</dt>
              <dd className="mono">{mm(cell.climatology, language)}</dd>
              <dt>{t("anomalia")}</dt>
              <dd
                className={`mono ${cell.anomalyPct >= 0 ? "is-wet" : "is-dry"}`}
              >
                {pct(cell.anomalyPct, language)}
              </dd>
            </dl>
          </>
        ) : (
          <p className="muted probe-hint">
            {t("Passe o cursor, toque ou use as setas no mapa. Clique ou pressione Enter para fixar a leitura.")}
          </p>
        )}
      </div>
    </aside>
  );
}
