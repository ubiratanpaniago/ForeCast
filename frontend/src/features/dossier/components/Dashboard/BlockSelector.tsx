import { useState } from "react";
import type { Snapshot } from "../../types/climate";
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
  const [row, setRow] = useState("1"),
    [column, setColumn] = useState("1");
  return (
    <div className="block-selector">
      <p className="eyebrow">Seleção persistente · bloco agregado</p>
      <p>
        {selected
          ? `Bloco fixado: linha ${selected[0] + 1}, coluna ${selected[1] + 1}. Permanece selecionado ao trocar o ano.`
          : "Clique ou toque no mapa, use as setas e Enter, ou escolha os índices abaixo."}
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
          Linha (1–{data.grid.lat.length})
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
          Coluna (1–{data.grid.lon.length})
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
        <button>Fixar bloco</button>
        {selected && (
          <button type="button" onClick={onClear}>
            Limpar
          </button>
        )}
      </form>
      <small>
        Índices locais deste snapshot de {data.grid.res}°. Não são IDs de
        células nativas da NASA.
      </small>
    </div>
  );
}
