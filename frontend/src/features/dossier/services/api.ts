import type { Snapshot } from "../types/climate";
import { parseSnapshot } from "./snapshotContract";

// A API (backend/app) ainda não expõe endpoints; até lá o frontend lê o
// snapshot gerado por backend/scripts/export_frontend_snapshot.py.
const SNAPSHOT_URL = "/data/snapshot.json";

export async function fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const timeout = AbortSignal.timeout(15000);
  const res = await fetch(SNAPSHOT_URL, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) {
    throw new Error(
      `Snapshot indisponível (${res.status}). Rode scripts/export_frontend_snapshot.py.`,
    );
  }
  return parseSnapshot(await res.json());
}
