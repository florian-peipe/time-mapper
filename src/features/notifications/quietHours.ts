/**
 * Quiet-hours preference — a window of the local-time day during which no
 * notification fires. Stored as `{ startH, endH }` where each is an integer
 * in [0, 23]. Windows that wrap midnight (e.g. 22 → 7) are supported.
 */
import type { KvRepo } from "@/db/repository/kv";
import { KV_KEYS } from "@/db/kvKeys";

export type QuietHours = { startH: number; endH: number };

export function getQuietHours(kv: KvRepo): QuietHours | null {
  const raw = kv.get(KV_KEYS.NOTIFIER_QUIET_HOURS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuietHours;
    if (
      typeof parsed.startH === "number" &&
      typeof parsed.endH === "number" &&
      parsed.startH >= 0 &&
      parsed.startH <= 23 &&
      parsed.endH >= 0 &&
      parsed.endH <= 23
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setQuietHours(kv: KvRepo, q: QuietHours | null): void {
  if (!q) {
    kv.delete(KV_KEYS.NOTIFIER_QUIET_HOURS);
    return;
  }
  kv.set(KV_KEYS.NOTIFIER_QUIET_HOURS, JSON.stringify(q));
}

/**
 * True if `nowS` falls inside the quiet-hours window. Supports windows that
 * wrap around midnight (e.g. 22→7).
 */
export function isQuietAt(nowS: number, q: QuietHours): boolean {
  const hour = new Date(nowS * 1000).getHours();
  if (q.startH === q.endH) return false; // zero-length window
  if (q.startH < q.endH) return hour >= q.startH && hour < q.endH;
  // Wraps midnight.
  return hour >= q.startH || hour < q.endH;
}
