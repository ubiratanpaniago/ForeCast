export interface MonthlyManifest {
  schemaVersion: number;
  gridId: string;
  revision: string;
  months: string[];
  unit: "mm";
  resolutionDegrees: number;
  grid: { lat: number[]; lon: number[]; res: number };
  cells: Array<{ id: string; index: number }>;
  referencePeriod: { start: number; end: number };
  requiredReferenceYears: number;
  climatology: Record<string, Array<number | null>>;
  referenceCounts: Record<string, number[]>;
  metadata: { productId: string; version: string; sourceDOI: string; qualityNotes: string[]; demonstrative: false };
}
export interface MonthlyYear {
  gridId: string;
  revision: string;
  year: number;
  unit: "mm";
  frames: Array<{ t: string; values: Array<number | null> }>;
}
export interface MonthlyCellSeries {
  gridId: string; revision: string; cellId: string; unit: "mm";
  series: Array<{ t: string; value: number | null; climatology: number | null; referenceCount: number; anomalyPct: number | null }>;
}
const base = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const endpoint = `${base}/api/monthly-rainfall`;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const validValue = (n: unknown) => n === null || (finite(n) && n >= 0);
export function monthlyAnomaly(value: number | null, reference: number | null): number | null {
  return value === null || reference === null || reference <= 0 ? null : (value-reference)/reference*100;
}
export function monthLabel(t: string) {
  const [year, month] = t.split("-").map(Number);
  return new Date(Date.UTC(year, month-1, 1)).toLocaleDateString("pt-BR", { month:"short", year:"numeric", timeZone:"UTC" });
}
async function request(url: string, signal: AbortSignal): Promise<unknown> {
  const result = await fetch(url, {signal:AbortSignal.any([signal, AbortSignal.timeout(20000)])});
  if (!result.ok) {
    const error = await result.json().catch(() => null);
    throw new Error(error?.error?.message || `Chuva mensal indisponível (HTTP ${result.status}).`);
  }
  return result.json();
}
export function parseMonthlyManifest(input: unknown): MonthlyManifest {
  const m = input as MonthlyManifest;
  const expected = Array.from({length:288}, (_,i) => `${2001+Math.floor(i/12)}-${String(i%12+1).padStart(2,"0")}`);
  if (!m || m.schemaVersion !== 1 || m.gridId !== "imerg-monthly-v07" || !m.revision || m.unit !== "mm"
    || m.resolutionDegrees !== .1 || m.grid?.res !== .1 || m.requiredReferenceYears !== 24
    || m.referencePeriod?.start !== 2001 || m.referencePeriod.end !== 2024
    || !Array.isArray(m.months) || m.months.length !== 288 || m.months.some((t,i) => t !== expected[i])
    || !Array.isArray(m.cells) || !m.cells.length || m.cells.length > 20000
    || m.metadata?.demonstrative !== false || !m.metadata.sourceDOI?.startsWith("10.")
    || !Array.isArray(m.metadata.qualityNotes)) throw new Error("Manifesto mensal incompatível.");
  for (const axis of [m.grid.lat, m.grid.lon]) {
    if (!Array.isArray(axis) || !axis.length || axis.some((v,i) => !finite(v) || (i>0 && Math.abs(v-axis[i-1]-.1)>1e-5)))
      throw new Error("Coordenadas da grade mensal inválidas.");
  }
  if (new Set(m.cells.map(c=>c.id)).size !== m.cells.length || new Set(m.cells.map(c=>c.index)).size !== m.cells.length
    || m.cells.some(c => !c.id?.startsWith(m.gridId+":") || !Number.isInteger(c.index) || c.index < 0 || c.index >= m.grid.lat.length*m.grid.lon.length))
    throw new Error("IDs ou índices da grade mensal inválidos.");
  for (let i=1; i<=12; i++) {
    const key = String(i).padStart(2,"0"), values = m.climatology?.[key], counts = m.referenceCounts?.[key];
    if (!Array.isArray(values) || !Array.isArray(counts) || values.length !== m.cells.length || counts.length !== m.cells.length
      || values.some((v,j) => !validValue(v) || !Number.isInteger(counts[j]) || counts[j]<0 || counts[j]>24 || (counts[j]<24 && v!==null)))
      throw new Error("Referência mensal inválida ou incompleta.");
  }
  return m;
}
export function parseMonthlyYear(input: unknown, manifest: MonthlyManifest, year: number): MonthlyYear {
  const y = input as MonthlyYear;
  if (!y || y.gridId !== manifest.gridId || y.revision !== manifest.revision || y.year !== year || y.unit !== "mm"
    || !Array.isArray(y.frames) || y.frames.length !== 12
    || y.frames.some((f,i) => f.t !== `${year}-${String(i+1).padStart(2,"0")}` || !Array.isArray(f.values)
      || f.values.length !== manifest.cells.length || f.values.some(v=>!validValue(v))))
    throw new Error("Quadro mensal incompatível com o ano, a grade ou a revisão.");
  return y;
}
export async function fetchMonthlyManifest(signal: AbortSignal) {
  return parseMonthlyManifest(await request(endpoint, signal));
}
export async function fetchMonthlyCell(m: MonthlyManifest, id: string, signal: AbortSignal) {
  const d = await request(`${endpoint}/cells/${encodeURIComponent(id)}/timeseries`,signal) as MonthlyCellSeries;
  if (!d || d.gridId !== m.gridId || d.revision !== m.revision || d.cellId !== id || d.unit !== "mm"
    || !Array.isArray(d.series) || d.series.length !== m.months.length
    || d.series.some((p,i) => p.t !== m.months[i] || !validValue(p.value) || !validValue(p.climatology)
      || !Number.isInteger(p.referenceCount) || p.referenceCount < 0 || p.referenceCount > 24 || (p.referenceCount<24 && p.climatology!==null)
      || !(p.anomalyPct === null || finite(p.anomalyPct))
      || (monthlyAnomaly(p.value,p.climatology) === null ? p.anomalyPct !== null
        : p.anomalyPct === null || Math.abs(p.anomalyPct-monthlyAnomaly(p.value,p.climatology)!)>1e-6)))
    throw new Error("Série mensal incompatível com a célula selecionada.");
  return d;
}
export class MonthlyFrameStore {
  readonly controller = new AbortController();
  readonly cache = new Map<number, MonthlyYear>();
  private pending = new Map<number, Promise<MonthlyYear>>();
  constructor(readonly manifest: MonthlyManifest) {}
  load(year: number): Promise<MonthlyYear> {
    const cached = this.cache.get(year);
    if (cached) return Promise.resolve(cached);
    const loading = this.pending.get(year);
    if (loading) return loading;
    const result = request(`${endpoint}/years/${year}?revision=${encodeURIComponent(this.manifest.revision)}`, this.controller.signal)
      .then(data => {
        const checked = parseMonthlyYear(data,this.manifest,year);
        this.cache.set(year,checked);
        while(this.cache.size>4) this.cache.delete(this.cache.keys().next().value!);
        return checked;
      }).finally(()=>this.pending.delete(year));
    this.pending.set(year,result);
    return result;
  }
  dispose() { this.controller.abort(); this.cache.clear(); this.pending.clear(); }
}
