export function MapControls({ onReset }: { onReset: () => void }) {
  return (
    <button
      className="reset-button"
      onClick={onReset}
      title="Restaurar enquadramento do Sul do Brasil"
    >
      <span aria-hidden="true">⌖</span> Restaurar vista
    </button>
  );
}
