import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Entry, Place } from "@/db/schema";

// expo-file-system v19 hides the classic functional API behind a non-typed
// default — mirror the cast pattern already used in `exportLog.ts` so we can
// call it without widening the types globally.
type LegacyFs = {
  cacheDirectory?: string | null;
  documentDirectory?: string | null;
  writeAsStringAsync: (uri: string, data: string, opts?: { encoding?: string }) => Promise<void>;
};

/**
 * Produce a CSV string for every non-deleted entry. Columns:
 *   date (YYYY-MM-DD), place, start (HH:MM), end (HH:MM or blank for ongoing),
 *   pause_minutes, net_minutes, source, note.
 *
 * Times are rendered in the device's local timezone so spreadsheet users see
 * the same clock they saw in the app. Note fields with embedded commas or
 * quotes are escaped per RFC 4180.
 *
 * Pure function — no side effects. Unit-testable without the file-system or
 * share-sheet modules.
 */
export function entriesToCsv(entries: Entry[], placesById: Map<string, Place>): string {
  const header = "date,place,start,end,pause_minutes,net_minutes,source,note";
  const rows = entries.map((e) => {
    const place = placesById.get(e.placeId);
    const started = new Date(e.startedAt * 1000);
    const ended = e.endedAt != null ? new Date(e.endedAt * 1000) : null;
    const date = ymd(started);
    const start = hhmm(started);
    const end = ended ? hhmm(ended) : "";
    const pauseMin = Math.round((e.pauseS ?? 0) / 60);
    const netMin = ended ? Math.max(0, Math.round((e.endedAt! - e.startedAt) / 60) - pauseMin) : 0;
    return [
      date,
      csvEscape(place?.name ?? ""),
      start,
      end,
      String(pauseMin),
      String(netMin),
      e.source,
      csvEscape(e.note ?? ""),
    ].join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function csvEscape(value: string): string {
  // RFC 4180: fields containing "," | "\n" | '"' must be quoted; embedded
  // quotes become "".
  if (value.length === 0) return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Write a CSV of all entries to a temp file and hand it to the platform
 * share sheet. Returns false if sharing is unavailable (e.g. simulator
 * without a receiving app); callers can surface a fallback.
 */
export async function exportEntriesCsv(
  entries: Entry[],
  placesById: Map<string, Place>,
): Promise<boolean> {
  const csv = entriesToCsv(entries, placesById);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fs = FileSystem as unknown as LegacyFs;
  const dir = fs.cacheDirectory ?? fs.documentDirectory ?? "";
  if (!dir) return false;
  const path = `${dir}timemapper-export-${ts}.csv`;
  await fs.writeAsStringAsync(path, csv);
  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }
  await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Time Mapper export" });
  return true;
}
