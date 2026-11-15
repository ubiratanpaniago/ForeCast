export function RegionTooltip({
  name,
  x,
  y,
}: {
  name: string;
  x: number;
  y: number;
}) {
  return (
    <div className="region-tooltip" style={{ left: x + 12, top: y + 12 }}>
      {name}
      <small>Clique para explorar</small>
    </div>
  );
}
