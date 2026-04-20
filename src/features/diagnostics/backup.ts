import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Place, Entry, PendingTransition } from "@/db/schema";

// expo-file-system v19: the classic functional API is hidden from the
// TypeScript types but still present at runtime — same cast pattern as
// exportLog.ts / exportEntries.ts.
type LegacyFs = {
  cacheDirectory?: string | null;
  documentDirectory?: string | null;
  writeAsStringAsync: (uri: string, data: string) => Promise<void>;
};

/**
 * Backup payload schema (v1). Deliberately simple: a top-level `version`
 * integer so the (eventual) restore path can branch on it, plus one array
 * per domain table. KV is not included by default — it contains UI prefs
 * that restore would overwrite, which isn't always what the user wants.
 *
 * `tamper` holds optional integrity data for audit use (see `tamperHash`
 * in this file). Consumers that don't care can ignore it.
 */
export type BackupPayloadV1 = {
  version: 1;
  generatedAt: string; // ISO8601
  places: Place[];
  entries: Entry[];
  pendingTransitions: PendingTransition[];
  tamper?: {
    algorithm: "djb2";
    /** Hex digest of a canonical serialization of `entries`. Prefixed with the algorithm. */
    entriesHash: string;
  };
};

/**
 * Build the backup payload from the repo layer. Pure — hands back a plain
 * object the caller can serialize, share, or (future) import elsewhere.
 */
export function buildBackupPayload(
  places: Place[],
  entries: Entry[],
  pendingTransitions: PendingTransition[],
): BackupPayloadV1 {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    places,
    entries,
    pendingTransitions,
    tamper: {
      algorithm: "djb2",
      entriesHash: tamperHash(entries),
    },
  };
}

/**
 * Deterministic hash over the entries array. Intended as a simple
 * integrity marker — a freelancer exporting their logs can verify the
 * hash matches what was recorded at export time (stored in KV or a
 * trusted external location). NOT a cryptographic audit log: anyone
 * with write access to the device can re-hash after editing. Real audit
 * logs need a signed chain, which is out of scope for v1.
 */
export function tamperHash(entries: Entry[]): string {
  // Canonical serialization: id-sorted, explicit key order. Avoids
  // reordering drift between two runs.
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const canonical = sorted
    .map(
      (e) =>
        `${e.id}|${e.placeId}|${e.startedAt}|${e.endedAt ?? "null"}|${e.pauseS ?? 0}|${e.source}|${e.note ?? ""}`,
    )
    .join("\n");
  return djb2(canonical);
}

/**
 * djb2 is a small deterministic string hash. Not cryptographic, just a
 * sanity marker so a user can spot accidental truncation of an exported
 * JSON. The algorithm name ships verbatim in the payload so a future
 * version can upgrade to SHA-256 (via `expo-crypto`) without breaking
 * verification of old exports.
 */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  // Unsigned, zero-padded hex. Prepend "djb2:" so future migrations can
  // tell old hashes apart from real SHA-256 payloads.
  return `djb2:${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Serialize + share a JSON backup via the native share sheet. Returns
 * false when sharing is unavailable (simulator without a receiver); the
 * caller can fall back to a clipboard copy or show an inline message.
 */
export async function exportBackupJson(payload: BackupPayloadV1): Promise<boolean> {
  const fs = FileSystem as unknown as LegacyFs;
  const dir = fs.cacheDirectory ?? fs.documentDirectory ?? "";
  if (!dir) return false;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${dir}timemapper-backup-${ts}.json`;
  await fs.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(path, {
    mimeType: "application/json",
    dialogTitle: "Time Mapper backup",
  });
  return true;
}
