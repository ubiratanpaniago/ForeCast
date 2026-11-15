export function annualColor(value: unknown, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return "#333d39";
  const ratio = Math.max(0, Math.min(1, value / maximum));
  const low = [224, 242, 209];
  const high = [32, 110, 157];
  return `rgb(${low.map((v, i) => Math.round(v + (high[i] - v) * ratio)).join(",")})`;
}
