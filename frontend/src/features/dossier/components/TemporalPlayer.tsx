import type { useTemporalPlayback } from "../hooks/useTemporalPlayback";
import { useLanguage } from "../../../i18n/LanguageContext";
type Playback = ReturnType<typeof useTemporalPlayback>;
export function TemporalPlayer({
  years,
  year,
  playback,
}: {
  years: number[];
  year: number;
  playback: Playback;
}) {
  const { language, t } = useLanguage();
  const index = years.indexOf(year);
  return (
    <div
      className="temporal-player"
      role="group"
      aria-label={t("Animação temporal anual")}
    >
      <div className="player-main">
        <button
          className="play-button"
          onClick={playback.toggle}
          aria-pressed={playback.playing}
          disabled={years.length < 2}
        >
          <span aria-hidden="true">{playback.playing ? "Ⅱ" : "▶"}</span>
          {playback.playing ? t("Pausar") : t("Reproduzir")}
        </button>
        <button
          className="step-button"
          onClick={() => playback.selectYear(years[index - 1])}
          disabled={index <= 0}
          aria-label={t("Ano anterior")}
        >
          ‹
        </button>
        <output className="player-year" aria-label={t("Ano exibido")}>
          {year}
        </output>
        <button
          className="step-button"
          onClick={() => playback.selectYear(years[index + 1])}
          disabled={index >= years.length - 1}
          aria-label={t("Próximo ano")}
        >
          ›
        </button>
        <label className="player-speed">
          {t("Velocidade")}
          <select
            aria-label={t("Velocidade da animação")}
            value={playback.speed}
            onChange={(e) => playback.setSpeed(Number(e.target.value))}
          >
            <option value={0.5}>{language === "pt" ? "0,5×" : "0.5×"}</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <label className="player-loop">
          <input
            type="checkbox"
            checked={playback.loop}
            onChange={(e) => playback.setLoop(e.target.checked)}
          />
          {t("Repetir")}
        </label>
      </div>
      <div className="player-track">
        <span>{years[0]}</span>
        <input
          type="range"
          min={0}
          max={years.length - 1}
          step={1}
          value={index}
          onChange={(e) => playback.selectYear(years[Number(e.target.value)])}
          aria-label={t("Selecionar ano da animação")}
          aria-valuetext={String(year)}
        />
        <span>{years[years.length - 1]}</span>
      </div>
      <p>
        {t("Um quadro por ano · chuva e anomalia usam o mesmo ano · valores observados no snapshot, sem interpolação temporal.")}
      </p>
    </div>
  );
}
