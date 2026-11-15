import type { Snapshot } from "../types/climate";
import { parseSnapshot } from "./snapshotContract";

export const snapshotMode =
  import.meta.env.VITE_SNAPSHOT_MODE === "static" ? "static" : "api";
const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const SNAPSHOT_URL =
  snapshotMode === "static" ? "/data/snapshot.json" : `${baseUrl}/api/snapshot`;

export async function fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const timeout = AbortSignal.timeout(15000);
  const res = await fetch(SNAPSHOT_URL, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
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
