import type { Entry } from "@/db/schema";

/**
 * Net minutes (gross − pause) for an entry, clamped to >= 0. Open
 * entries (no `endedAt`) contribute 0 — the Timeline + Stats treat
 * the running timer card as the source of truth for ongoing time.
 */
export function netMinutes(entry: Entry): number {
  if (entry.endedAt == null) return 0;
  const seconds = entry.endedAt - entry.startedAt - (entry.pauseS ?? 0);
  if (seconds <= 0) return 0;
  return Math.round(seconds / 60);
}
