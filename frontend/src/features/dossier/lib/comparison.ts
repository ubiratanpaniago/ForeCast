import type { Snapshot } from "../types/climate";
export function compareYears(
  data: Snapshot,
  year: number,
  reference: number,
  block: [number, number] | null = null,
) {
  const index = block ? block[0] * data.grid.lon.length + block[1] : null;
  const value = (y: number) =>
    index === null ? data.annual.regional[y] : data.annual.byYear[y]?.[index];
  const current = value(year);
  const baseline = value(reference);
  const climatology =
    index === null
      ? data.annual.regionalClimatology
      : data.annual.climatology[index];
  const available = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  const delta =
    available(current) && available(baseline) ? current - baseline : null;
  const percent =
    delta !== null && baseline > 0 ? (delta / baseline) * 100 : null;
  const anomaly = (v: number) =>
    available(v) && climatology > 0
      ? ((v - climatology) / climatology) * 100
      : null;
  return {
    current: available(current) ? current : null,
    reference: available(baseline) ? baseline : null,
    delta,
    percent,
    currentAnomaly: anomaly(current),
    referenceAnomaly: anomaly(baseline),
  };
}
export function monthlyCoverage(
  data: Snapshot,
  key: "precipitation" | "soilMoisture",
) {
  const dates = new Set(data.monthly[key].map((p) => p.t));
  return data.years.map((year) => ({
    year,
    valid: Array.from(
      { length: 12 },
      (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
    ).filter((t) => dates.has(t)).length,
  }));
}
