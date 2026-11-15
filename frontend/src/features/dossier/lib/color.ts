type RGB = [number, number, number];

const hex = (h: string): RGB =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

function ramp(stops: string[]) {
  const rgb = stops.map(hex);
  return (t: number): RGB => {
    const x = Math.min(1, Math.max(0, t)) * (rgb.length - 1);
    const i = Math.min(rgb.length - 2, Math.floor(x));
    const f = x - i;
    return rgb[i].map((c, k) => Math.round(c + (rgb[i + 1][k] - c) * f)) as RGB;
  };
}

// Seco (terra queimada) -> neutro (papel) -> úmido (petróleo)
export const ANOMALY_STOPS = [
  "#6e3410",
  "#b9783f",
  "#ece3cf",
  "#5c9ea0",
  "#0c4655",
];
export const TOTAL_STOPS = [
  "#f1e8cf",
  "#bcd6c2",
  "#5f9fa0",
  "#245f75",
  "#13294a",
];
export const ANOMALY_RANGE = 50;
export const TOTAL_RANGE: [number, number] = [800, 2800];

const anomalyRamp = ramp(ANOMALY_STOPS);
const totalRamp = ramp(TOTAL_STOPS);

export const anomalyColor = (pct: number) =>
  anomalyRamp((pct + ANOMALY_RANGE) / (2 * ANOMALY_RANGE));
export const totalColor = (v: number) =>
  totalRamp((v - TOTAL_RANGE[0]) / (TOTAL_RANGE[1] - TOTAL_RANGE[0]));
export const css = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`;
