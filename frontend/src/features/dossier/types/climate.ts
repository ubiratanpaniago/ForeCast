export interface MonthlyPoint {
  /** "AAAA-MM" */
  t: string;
  v: number;
}

export interface SourceInfo {
  key: string;
  product: string;
  variable: string;
  unit: string;
}

export interface Snapshot {
  meta: {
    generated: string;
    bbox: { west: number; south: number; east: number; north: number };
    sources: SourceInfo[];
    notes: string[];
  };
  /** Grade dos totais anuais; lat crescente, valores achatados lat x lon. */
  grid: { lat: number[]; lon: number[]; res: number };
  landMask: { lat: number[]; lon: number[]; res: number; rows: string[] };
  years: number[];
  annual: {
    climatology: number[];
    byYear: Record<string, number[]>;
    regional: Record<string, number>;
    regionalClimatology: number;
  };
  monthly: { precipitation: MonthlyPoint[]; soilMoisture: MonthlyPoint[] };
}

export type MapMode = "anomaly" | "total";
export type SeriesKey = "precipitation" | "soilMoisture";

export interface CellReading {
  lat: number;
  lon: number;
  total: number;
  climatology: number;
  anomalyPct: number;
  land: boolean;
}

export interface YearSummary {
  year: number;
  total: number;
  anomalyPct: number;
  /** 1 = ano mais seco da série */
  rankDry: number;
  wettestMonth: MonthlyPoint;
  driestMonth: MonthlyPoint;
  soilMean: number | null;
  soilMonths: number;
}
