import { useState } from "react";
import type { Snapshot } from "../../types/climate";
import { useLanguage } from "../../../../i18n/LanguageContext";
export function BlockSelector({
  data,
  selected,
  onSelect,
  onClear,
}: {
  data: Snapshot;
  selected: [number, number] | null;
  onSelect: (ij: [number, number]) => void;
  onClear: () => void;
}) {
  const { t } = useLanguage();
  const [row, setRow] = useState("1"),
    [column, setColumn] = useState("1");
  return (
    <div className="block-selector">
      <p className="eyebrow">{t("Seleção persistente · bloco agregado")}</p>
      <p>
        {selected
          ? t("Bloco fixado: linha {row}, coluna {column}. Permanece selecionado ao trocar o ano.").replace("{row}", String(selected[0] + 1)).replace("{column}", String(selected[1] + 1))
          : t("Clique ou toque no mapa, use as setas e Enter, ou escolha os índices abaixo.")}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const i = Number(row) - 1,
            j = Number(column) - 1;
          if (
            Number.isInteger(i) &&
            Number.isInteger(j) &&
            i >= 0 &&
            j >= 0 &&
            i < data.grid.lat.length &&
            j < data.grid.lon.length
          )
            onSelect([i, j]);
        }}
      >
        <label>
          {t("Linha (1–{count})").replace("{count}", String(data.grid.lat.length))}
          <input
            type="number"
            min={1}
            max={data.grid.lat.length}
            step={1}
            required
            value={row}
            onChange={(e) => setRow(e.target.value)}
          />
        </label>
        <label>
          {t("Coluna (1–{count})").replace("{count}", String(data.grid.lon.length))}
          <input
            type="number"
            min={1}
            max={data.grid.lon.length}
            step={1}
            required
            value={column}
            onChange={(e) => setColumn(e.target.value)}
          />
        </label>
        <button>{t("Fixar bloco")}</button>
        {selected && (
          <button type="button" onClick={onClear}>
            {t("Limpar")}
          </button>
        )}
      </form>
      <small>
        {t("Índices locais deste snapshot de {resolution}°. Não são IDs de células nativas da NASA.").replace("{resolution}", String(data.grid.res))}
      </small>
    </div>
  );
}
