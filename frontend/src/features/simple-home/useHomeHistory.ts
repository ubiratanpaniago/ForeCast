import { useEffect, useRef, useState } from "react";
import { fetchMonthlyCell, MonthlyFrameStore, type MonthlyManifest } from "../dossier/services/monthlyApi";
import { rainSummary } from "./homeData";

export interface HomePoint { t: string; value: number | null; reference: number | null }
export function useHomeHistory(manifest: MonthlyManifest | null, cellId: string | null) {
  const cache = useRef(new Map<string, HomePoint[]>());
  const [result, setResult] = useState<{ key: string; points: HomePoint[] } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const key = manifest ? `${manifest.revision}/${cellId ?? "south"}` : "";
  useEffect(() => {
    if (!manifest) return;
    const controller = new AbortController();
    const store = new MonthlyFrameStore(manifest);
    setError("");
    const remembered = cache.current.get(key);
    if (remembered) { setResult({ key, points: remembered }); return () => store.dispose(); }
    async function load(): Promise<HomePoint[]> {
      if (cellId) {
        const data = await fetchMonthlyCell(manifest!, cellId, controller.signal);
        return data.series.map(p => ({ t: p.t, value: p.value, reference: p.climatology }));
      }
      // The existing API has year blocks, so aggregate the same native cells locally.
      // Two requests at a time keep the map responsive; no backend changes are needed.
      const years = Array.from(new Set(manifest!.months.map(t => Number(t.slice(0, 4)))));
      const points: HomePoint[] = [];
      let next = 0;
      const worker = async () => {
        while (next < years.length && !controller.signal.aborted) {
          const year = years[next++];
          const chunk = await store.load(year);
          for (const frame of chunk.frames) {
            const summary = rainSummary(frame.values, manifest!.climatology[frame.t.slice(5, 7)]);
            points.push({ t: frame.t, value: summary.value, reference: summary.reference });
          }
        }
      };
      await Promise.all([worker(), worker()]);
      return points.sort((a, b) => a.t.localeCompare(b.t));
    }
    void load().then(points => {
      if (controller.signal.aborted) return;
      cache.current.set(key, points);
      while (cache.current.size > 8) cache.current.delete(cache.current.keys().next().value!);
      setResult({ key, points });
    }).catch(() => {
      if (!controller.signal.aborted) setError("Não foi possível carregar o gráfico.");
      store.dispose();
    });
    return () => { controller.abort(); store.dispose(); };
  }, [manifest, cellId, key, retry]);
  return { points: result?.key === key ? result.points : null, error, retry: () => setRetry(v => v + 1) };
}
