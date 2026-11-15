import { useEffect, useState } from "react";
import { getRegions, getTrendResults } from "../services/climateMapApi";
import type {
  TrendResult,
  LoadState,
  MapQuery,
  RegionsGeoJSON,
} from "../types/geography";
export function useClimateMap(query: MapQuery, retry: number) {
  const [regions, setRegions] = useState<RegionsGeoJSON | null>(null);
  const [values, setValues] = useState<TrendResult[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setValues([]);
    setError("");
    (async () => {
      try {
        const geo = await getRegions(controller.signal);
        if (controller.signal.aborted) return;
        setRegions(geo);
        const data = await getTrendResults(
          geo.features.map((f) => f.properties.id),
          query,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setValues(data);
          setStatus("ready");
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setStatus("error");
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar os dados.",
          );
        }
      }
    })();
    return () => controller.abort();
  }, [query.layer, query.indicator, query.start, query.end, retry]);
  return { regions, values, status, error };
}
