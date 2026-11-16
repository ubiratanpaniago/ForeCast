import type { RegionsGeoJSON } from "../../types/geography";
// Native IMERG cell centered at approximately 28.05° S, 52.45° W, near Passo Fundo/RS.
export const EXAMPLE_CELL_ID = "imerg-monthly-v07:r619:c1275";

export interface RainSummary { value: number | null; reference: number | null; count: number }
export function rainSummary(values: Array<number | null>, reference: Array<number | null>): RainSummary {
  let total = 0, normal = 0, count = 0;
  values.forEach((v, i) => {
    const r = reference[i];
    if (v !== null && r !== null && r !== undefined) { total += v; normal += r; count++; }
  });
  return { value: count ? total / count : null, reference: count ? normal / count : null, count };
}
export function fullMonth(t: string, locale = "pt-BR") {
  const [year, month] = t.split("-").map(Number);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: "long", year: "numeric", timeZone: "UTC",
  });
  return locale === "pt-BR" ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}
export function rainDescription(anomaly: number | null, locale = "pt-BR") {
  if (locale === "en-US") {
    if (anomaly === null) return "Comparison unavailable";
    if (anomaly === 0) return "Rainfall matches the historical average";
    const amount = Math.abs(anomaly).toLocaleString(locale, { maximumFractionDigits: 1 });
    return `${amount}% ${anomaly > 0 ? "more" : "less"} rain than usual`;
  }
  if (anomaly === null) return "Comparação indisponível";
  if (anomaly === 0) return "Chuva igual à média histórica";
  const amount = Math.abs(anomaly).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${amount}% ${anomaly > 0 ? "mais" : "menos"} chuva que o habitual`;
}

function inRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [xj, yj] = ring[j];
    if ((y > lat) !== (yj > lat) && lon < (xj - x) * (lat - y) / (yj - y) + x) inside = !inside;
  }
  return inside;
}
export function placeName(geo: RegionsGeoJSON | null, lon: number, lat: number) {
  if (!geo) return "Lugar escolhido no mapa";
  const match = geo.features.find(feature => {
    if (feature.properties.level !== "regiao_intermediaria") return false;
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.some(rings => inRing(lon, lat, rings[0]) && !rings.slice(1).some(r => inRing(lon, lat, r)));
  });
  return match ? `Região de ${match.properties.name}` : "Lugar escolhido no mapa";
}
