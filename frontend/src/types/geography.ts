import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
export type LayerId = "trend" | "neutral";
export type IndicatorId =
  "PRCP_ANNUAL" | "RX1DAY" | "R50MM" | "SOIL_SURFACE" | "SOIL_ROOT";
export interface Period {
  start: number;
  end: number;
}
export interface Region {
  id: string;
  name: string;
  abbreviation: string;
  [key: string]: unknown;
}
export type RegionsGeoJSON = FeatureCollection<Polygon | MultiPolygon, Region>;
export interface TrendResult {
  regionId: string;
  indicator: IndicatorId;
  period: Period;
  series: Array<{ year: number; value: number | null }>;
  statistics: {
    slopePerDecade: number | null;
    pValue: number | null;
    tau: number | null;
    confidenceInterval95: [number, number] | null;
    direction: "increasing" | "decreasing" | "inconclusive";
    status: "valid" | "exploratory" | "insufficient";
    method: string;
  };
  metadata: {
    unit: string;
    productId: string;
    version: string;
    sourceDOI: string;
    qualityNotes: string[];
    demonstrative: boolean;
  };
}
export interface MapQuery {
  layer: LayerId;
  indicator: IndicatorId;
  start: number;
  end: number;
}
export type LoadState = "loading" | "ready" | "error";
