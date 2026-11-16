import type { Snapshot } from "../types/climate";
import { parseSnapshot } from "./snapshotContract";
import { apiFetch } from "../../../services/apiFetch";

export const snapshotMode =
  import.meta.env.VITE_SNAPSHOT_MODE === "static" ? "static" : "api";
const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const SNAPSHOT_URL =
  snapshotMode === "static" ? "/data/snapshot.json" : `${baseUrl}/api/snapshot`;

export async function fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const res = await apiFetch(SNAPSHOT_URL, { signal, timeoutMs: 15000 });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : `Snapshot indisponível (HTTP ${res.status}).`,
    );
  }
  return parseSnapshot(await res.json());
}
