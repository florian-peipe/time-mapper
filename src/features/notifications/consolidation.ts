/**
 * Rate-limit + consolidation logic for notifications. When more than
 * `CONSOLIDATION_THRESHOLD` transitions happen inside
 * `CONSOLIDATION_WINDOW_S` seconds, instead of firing N individual notifications
 * we emit one "3 transitions at {place}" summary. Keeps lock-screen noise low
 * during frequent in/out patterns (e.g. taking the dog outside).
 *
 * Stateless — the caller passes in the current "recent timestamps" array and
 * gets back the updated one alongside the decision.
 */
import type { KvRepo } from "@/db/repository/kv";
import type { Place } from "@/db/schema";
import { i18n } from "@/lib/i18n";
import { formatDurationCompact } from "@/lib/time";
import { KV_KEYS } from "@/db/kvKeys";
import { isQuietAt, type QuietHours } from "./quietHours";

const RING_CAPACITY = 10;
const CONSOLIDATION_THRESHOLD = 3;
const CONSOLIDATION_WINDOW_S = 10 * 60;

export type Decision =
  | {
      kind: "fire" | "consolidate";
      title: string;
      body: string;
      recent: number[];
    }
  | { kind: "skip"; reason: string; recent: number[] };

export function readRecent(kv: KvRepo): number[] {
  const raw = kv.get(KV_KEYS.NOTIFIER_RECENT);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr.filter((x) => typeof x === "number") as number[]) : [];
  } catch {
    return [];
  }
}

export function writeRecent(kv: KvRepo, xs: number[]): void {
  kv.set(KV_KEYS.NOTIFIER_RECENT, JSON.stringify(xs.slice(-RING_CAPACITY)));
}

/**
 * Decide whether to fire a notification.
 *
 *   - `fire`         — schedule this as a normal notification
 *   - `consolidate`  — group into a single "N transitions" bundle
 *   - `skip`         — no notification (quiet hours hit)
 *
 * Pure function — state flows in via `recent` + `quiet`, out via the
 * returned `recent` array the caller persists.
 */
export function decideNotification(opts: {
  kind: "open" | "close";
  place: Place;
  durationS?: number;
  nowS: number;
  recent: number[];
  quiet: QuietHours | null;
}): Decision {
  const { place, nowS, quiet, kind, durationS } = opts;

  if (quiet && isQuietAt(nowS, quiet)) {
    return { kind: "skip", reason: "quiet_hours", recent: opts.recent };
  }

  const pruned = opts.recent.filter((t) => t > nowS - CONSOLIDATION_WINDOW_S);
  const withThis = [...pruned, nowS].slice(-RING_CAPACITY);

  if (pruned.length >= CONSOLIDATION_THRESHOLD - 1) {
    return {
      kind: "consolidate",
      title: i18n.t("notifier.consolidated.title", { count: withThis.length }),
      body: i18n.t("notifier.consolidated.body", { name: place.name }),
      recent: withThis,
    };
  }

  if (kind === "open") {
    return {
      kind: "fire",
      title: i18n.t("notifier.opened.title"),
      body: i18n.t("notifier.opened.body", { name: place.name }),
      recent: withThis,
    };
  }
  return {
    kind: "fire",
    title: i18n.t("notifier.closed.title"),
    body: i18n.t("notifier.closed.body", {
      name: place.name,
      duration: formatDurationCompact(durationS ?? 0),
    }),
    recent: withThis,
  };
}
