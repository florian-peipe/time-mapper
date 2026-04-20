import { Platform } from "react-native";
import type * as ExpoNotifications from "expo-notifications";
import type * as KvModule from "@/db/repository/kv";
import type * as EntriesModule from "@/db/repository/entries";
import type { Effect } from "@/features/tracking/stateMachine";
import type { PlacesRepo } from "@/db/repository/places";
import type { Place } from "@/db/schema";
import { i18n } from "@/lib/i18n";

type KvRepo = InstanceType<typeof KvModule.KvRepo>;

const KV_RECENT_TIMESTAMPS = "notifier.recent";
const KV_QUIET_HOURS = "notifier.quiet_hours";
const KV_CHANNELS_CONFIGURED = "notifier.channels_configured";
const KV_DIGEST_ENABLED = "notifier.digest.enabled";
const KV_DIGEST_HOUR = "notifier.digest.hour";
const KV_DIGEST_ID = "notifier.digest.scheduled_id";

const RING_CAPACITY = 10;
const CONSOLIDATION_THRESHOLD = 3;
const CONSOLIDATION_WINDOW_S = 10 * 60;

export const ANDROID_CHANNEL_ID = "timemapper-tracking";
export const IOS_CATEGORY_ID = "timemapper-tracking";

export type QuietHours = { startH: number; endH: number };

/**
 * Thin reference to `expo-notifications`, looked up lazily so Jest can run
 * these units without the native module in the import graph.
 */
function getNotifications(): typeof ExpoNotifications {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as typeof ExpoNotifications;
}

function readRecent(kv: KvRepo): number[] {
  const raw = kv.get(KV_RECENT_TIMESTAMPS);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr.filter((x) => typeof x === "number") as number[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(kv: KvRepo, xs: number[]): void {
  kv.set(KV_RECENT_TIMESTAMPS, JSON.stringify(xs.slice(-RING_CAPACITY)));
}

export function getQuietHours(kv: KvRepo): QuietHours | null {
  const raw = kv.get(KV_QUIET_HOURS);
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
    kv.delete(KV_QUIET_HOURS);
    return;
  }
  kv.set(KV_QUIET_HOURS, JSON.stringify(q));
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

/**
 * Decide whether to fire a notification. Returns one of:
 *   - { kind: "fire", payload }                 — schedule this as a notification
 *   - { kind: "consolidate", payload }          — consolidated "N transitions" bundle
 *   - { kind: "skip", reason }                  — no notification (quiet hours, etc.)
 *
 * Exported as a pure function for unit testing.
 */
export type Decision =
  | {
      kind: "fire" | "consolidate";
      title: string;
      body: string;
      recent: number[];
    }
  | { kind: "skip"; reason: string; recent: number[] };

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
    // Already had ≥2 in window — consolidate.
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
      duration: formatDuration(durationS ?? 0),
    }),
    recent: withThis,
  };
}

function formatDuration(s: number): string {
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/**
 * Schedule a local notification immediately. Wraps `scheduleNotificationAsync`
 * with iOS category + Android channel. Errors are swallowed — we cannot
 * afford to crash the background task.
 */
export async function fireNotification(title: string, body: string): Promise<void> {
  try {
    const N = getNotifications();
    await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        categoryIdentifier: IOS_CATEGORY_ID,
      },
      trigger: null, // immediate
    });
  } catch (err) {
    console.warn("[notifier] fire failed:", err);
  }
}

/**
 * One-time setup for iOS categories + Android channels. Safe to call on
 * every app start — the APIs are idempotent. Guarded by a KV flag so we
 * don't re-POST the config repeatedly (the native call is cheap but does
 * spin up a bridge hop).
 */
export async function configureNotificationChannels(kv: KvRepo): Promise<void> {
  if (kv.get(KV_CHANNELS_CONFIGURED) === "1") return;
  try {
    const N = getNotifications();
    await N.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: i18n.t("notifier.channel.name"),
      importance: N.AndroidImportance.LOW,
      vibrationPattern: [0, 100, 0, 100],
      lightColor: "#FF7A1A",
    });
    // iOS categories only — Android's setNotificationCategoryAsync rejects
    // an empty actions array with InvalidArgumentException; we don't need
    // any category on Android since we don't attach action buttons.
    if (Platform.OS === "ios") {
      await N.setNotificationCategoryAsync(IOS_CATEGORY_ID, []);
    }
    kv.set(KV_CHANNELS_CONFIGURED, "1");
  } catch (err) {
    console.warn("[notifier] channel config failed:", err);
  }
}

/** Read the stored daily-digest enabled flag. Default: disabled. */
export function getDailyDigestEnabled(kv: KvRepo): boolean {
  return kv.get(KV_DIGEST_ENABLED) === "1";
}

/** Read the stored daily-digest hour (0-23). Default: 8. */
export function getDailyDigestHour(kv: KvRepo): number {
  const raw = kv.get(KV_DIGEST_HOUR);
  const n = raw == null ? 8 : Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : 8;
}

/**
 * Turn the daily digest reminder on / off, persisting enabled state and
 * hour to KV, and scheduling/cancelling the native daily notification.
 * Re-scheduling the same hour after a change is fine — we cancel the
 * previous id first so duplicates don't pile up.
 *
 * Uses expo-notifications' `DailyTriggerInput`: fires every day at
 * `hour:00`. Body copy is static ("Your daily summary is ready") because
 * we can't compute yesterday's totals inside a pre-scheduled payload —
 * the user tapping the notification opens the app which can then show
 * the fresh data.
 */
export async function setDailyDigestSchedule(
  kv: KvRepo,
  opts: { enabled: boolean; hour: number },
): Promise<void> {
  const { enabled, hour } = opts;
  const clampedHour = Math.min(23, Math.max(0, Math.floor(hour)));
  kv.set(KV_DIGEST_HOUR, String(clampedHour));
  // Always cancel any previously scheduled id before (re-)scheduling.
  const prevId = kv.get(KV_DIGEST_ID);
  if (prevId) {
    try {
      const N = getNotifications();
      await N.cancelScheduledNotificationAsync(prevId);
    } catch {
      // Ignore — the id may have already been consumed or the platform
      // may not expose cancellation; either way we'll overwrite below.
    }
    kv.delete(KV_DIGEST_ID);
  }
  if (!enabled) {
    kv.delete(KV_DIGEST_ENABLED);
    return;
  }
  kv.set(KV_DIGEST_ENABLED, "1");
  try {
    const N = getNotifications();
    const id = await N.scheduleNotificationAsync({
      content: {
        title: i18n.t("notifier.digest.title"),
        body: i18n.t("notifier.digest.body"),
        sound: "default",
        categoryIdentifier: IOS_CATEGORY_ID,
      },
      trigger: {
        // Drizzle-style: cast the shape to `any` is unnecessary —
        // expo-notifications' DailyTriggerInput is `{ hour, minute, repeats }`.
        // `type: "daily"` in SDK 54+. We target both shapes with a cast so
        // the call works across point releases.
        hour: clampedHour,
        minute: 0,
        repeats: true,
      } as any,
    });
    kv.set(KV_DIGEST_ID, id);
  } catch (err) {
    console.warn("[notifier] daily digest schedule failed:", err);
  }
}

/**
 * Entry point used by the background task. Iterates over the effects the
 * state machine produced and fires an appropriate notification for any
 * `open_entry` / `close_entry`. Applies rate-limiting and quiet hours.
 *
 * Needs a KvRepo for state — constructs one lazily from the same db the
 * PlacesRepo already holds.
 */
export async function maybeNotifyForEffects(
  effects: Effect[],
  placesRepo: PlacesRepo,
  nowS: number,
): Promise<void> {
  const fireable = effects.filter((e) => e.kind === "open_entry" || e.kind === "close_entry");
  if (fireable.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { KvRepo: KvCtor } = require("@/db/repository/kv") as typeof KvModule;
  const db = (placesRepo as unknown as { db: ConstructorParameters<typeof KvCtor>[0] }).db;
  const kv = new KvCtor(db);

  const quiet = getQuietHours(kv);
  let recent = readRecent(kv);

  for (const eff of fireable) {
    if (eff.kind === "open_entry") {
      const place = placesRepo.get(eff.placeId);
      if (!place) continue;
      const decision = decideNotification({
        kind: "open",
        place,
        nowS,
        recent,
        quiet,
      });
      if (decision.kind !== "skip") {
        await fireNotification(decision.title, decision.body);
      }
      recent = decision.recent;
    } else {
      // close_entry
      const allEntries = getEntryById(placesRepo, eff.entryId);
      if (!allEntries) continue;
      const { place, durationS } = allEntries;
      const decision = decideNotification({
        kind: "close",
        place,
        durationS,
        nowS,
        recent,
        quiet,
      });
      if (decision.kind !== "skip") {
        await fireNotification(decision.title, decision.body);
      }
      recent = decision.recent;
    }
  }

  writeRecent(kv, recent);
}

/**
 * Look up the entry and its place for a close_entry effect. Returns the
 * associated place + computed duration, or null if the entry was deleted
 * before we got here (shouldn't happen in practice, but we'd rather skip
 * the notification than crash).
 */
function getEntryById(
  placesRepo: PlacesRepo,
  entryId: string,
): { place: Place; durationS: number } | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EntriesRepo } = require("@/db/repository/entries") as typeof EntriesModule;
  const db = (placesRepo as unknown as { db: ConstructorParameters<typeof EntriesRepo>[0] }).db;
  const entries = new EntriesRepo(db);
  const entry = entries.get(entryId);
  if (!entry) return null;
  const place = placesRepo.get(entry.placeId);
  if (!place) return null;
  const endedAt = entry.endedAt ?? Math.floor(Date.now() / 1000);
  return { place, durationS: endedAt - entry.startedAt };
}
