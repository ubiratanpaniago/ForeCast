import type { MonthlyManifest } from "../dossier/services/monthlyApi";
import { useHomeHistory, type HomePoint } from "./useHomeHistory";

function seriesPath(points: HomePoint[], field: "value" | "reference", max: number) {
  let path = "", connected = false;
  points.forEach((p, i) => {
    const value = p[field];
    if (value === null) { connected = false; return; }
    path += `${connected ? "L" : "M"}${(28 + i / Math.max(1, points.length - 1) * 644).toFixed(2)},${(170 - value / max * 148).toFixed(2)} `;
    connected = true;
  });
  return path;
}
export function HomeHistory({ manifest, cellId, month }: {
  manifest: MonthlyManifest | null; cellId: string | null; month: string;
}) {
  const { points, error, retry } = useHomeHistory(manifest, cellId);
  const max = points ? Math.max(1, ...points.flatMap(p => [p.value ?? 0, p.reference ?? 0])) : 1;
  const cursor = points?.findIndex(p => p.t === month) ?? -1;
  return <section className="home-history" aria-labelledby="home-history-title">
    <div className="home-section-heading"><h2 id="home-history-title">Como a chuva mudou</h2><span>2001 a 2024</span></div>
    <p>{cellId ? "Histórico do ponto escolhido no mapa." : "Histórico das áreas do Sul mostradas no mapa."}</p>
    {error ? <div className="home-chart-message" role="alert">{error} <button onClick={retry}>Tentar novamente</button></div>
      : !points ? <div className="home-chart-message" role="status">Carregando a história das chuvas…</div>
      : <>
        <svg className="home-history-chart" viewBox="0 0 700 205" role="img"
          aria-label={`Chuva mensal de 2001 a 2024. Linha contínua: chuva registrada. Linha tracejada: média histórica. Escala de zero a ${Math.ceil(max)} milímetros.`}>
          <line x1={28} x2={672} y1={170} y2={170} stroke="var(--rule)" />
          <line x1={28} x2={672} y1={96} y2={96} stroke="var(--rule)" strokeDasharray="3 5" />
          <path d={seriesPath(points, "reference", max)} fill="none" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1.5} />
          <path d={seriesPath(points, "value", max)} fill="none" stroke="var(--wet)" strokeWidth={2} />
          {cursor >= 0 && <line x1={28 + cursor / Math.max(1, points.length - 1) * 644}
            x2={28 + cursor / Math.max(1, points.length - 1) * 644} y1={18} y2={174} stroke="var(--accent)" strokeWidth={2} />}
          <text x={28} y={198}>2001</text><text x={624} y={198}>2024</text>
          <text x={28} y={15}>{Math.ceil(max)} mm</text>
        </svg>
        <div className="home-chart-key"><span><i className="home-key-rain" /> Chuva registrada</span><span><i className="home-key-average" /> Média histórica</span></div>
      </>}
  </section>;
}
