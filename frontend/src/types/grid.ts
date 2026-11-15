import type { FeatureCollection, Polygon } from "geojson";
import type { IndicatorId, Period, TrendResult } from "./geography";
export type BBox = [number, number, number, number];
export interface GridDefinition {
  id: string;
  name: string;
  productId: string;
  version: string;
  resolutionDegrees: 0.1 | 0.25;
  crs: "EPSG:4326";
  indicators: IndicatorId[];
  period: Period;
  revision: string;
  available: boolean;
  unavailableReason?: string;
}
export type CellSummary = Omit<TrendResult, "regionId" | "series">;
export interface GridCell {
  id: string;
  gridId: string;
  row: number;
  column: number;
  center: [number, number];
  bounds: BBox;
  fractionInside: number | null;
  summary: CellSummary | null;
}
export interface GridCells extends FeatureCollection<Polygon, GridCell> {
  gridId: string;
  revision: string;
  indicator: IndicatorId;
  period: Period;
  truncated: boolean;
}
export interface CellDetail {
  gridId: string;
  revision: string;
  cellId: string;
  indicator: IndicatorId;
  period: Period;
  series: TrendResult["series"];
  statistics: TrendResult["statistics"] | null;
  metadata: TrendResult["metadata"];
}
export const studyBounds: BBox = [-58, -34, -47, -22];
