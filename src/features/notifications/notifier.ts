/**
 * Orchestrates local notifications for state-machine effects produced by
 * the tracking pipeline. Each effect (open / close entry) is translated
 * into a decision via `decideNotification` (respects quiet hours +
 * consolidation), then scheduled through `fireNotification`. After a close,
 * `maybeNotifyGoalReached` checks whether a goal crossed its target.
 *
 * Submodules:
 *   - `quietHours.ts`     — quiet-hours KV read/write + range check
 *   - `consolidation.ts`  — decideNotification + ring-buffer state
 *   - `channels.ts`       — iOS category + Android channel setup
 *   - `digest.ts`         — daily digest scheduler
 */
import type * as ExpoNotifications from "expo-notifications";
import type { AnyDb } from "@/db/client";
import { KvRepo } from "@/db/repository/kv";
import { EntriesRepo } from "@/db/repository/entries";
import type { Effect } from "@/features/tracking/stateMachine";
import type { PlacesRepo } from "@/db/repository/places";
import type { Place } from "@/db/schema";
import { captureException } from "@/lib/crash";
import { nowS as getNowS } from "@/lib/time";
import { maybeNotifyGoalReached as goalsNotifier } from "@/features/goals/goalsNotifier";
import { decideNotification, readRecent, writeRecent } from "./consolidation";
import { getQuietHours } from "./quietHours";
import { IOS_CATEGORY_ID } from "./channels";

export { ANDROID_CHANNEL_ID, IOS_CATEGORY_ID, configureNotificationChannels } from "./channels";
export { getQuietHours, setQuietHours, isQuietAt, type QuietHours } from "./quietHours";
export { decideNotification, type Decision } from "./consolidation";
export { getDailyDigestEnabled, getDailyDigestHour, setDailyDigestSchedule } from "./digest";

/**
 * Schedule a local notification immediately. Wraps
 * `scheduleNotificationAsync` with iOS category + default sound. Errors are
 * swallowed — the background task cannot afford to crash here.
 */
export async function fireNotification(title: string, body: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N = require("expo-notifications") as typeof ExpoNotifications;
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
    captureException(err, { scope: "notifications.fire" });
  }
}

/**
 * Entry point used by the background task. Iterates over the effects the
 * state machine produced and fires an appropriate notification for any
 * `open_entry` / `close_entry`. Applies rate-limiting (consolidation) and
 * quiet hours.
 */
export async function maybeNotifyForEffects(
  effects: Effect[],
  placesRepo: PlacesRepo,
  db: AnyDb,
  nowS: number,
): Promise<void> {
  const fireable = effects.filter((e) => e.kind === "open_entry" || e.kind === "close_entry");
  if (fireable.length === 0) return;

  const kv = new KvRepo(db);
  const quiet = getQuietHours(kv);
  let recent = readRecent(kv);

  for (const eff of fireable) {
    if (eff.kind === "open_entry") {
      const place = placesRepo.get(eff.placeId);
      if (!place) continue;
      const decision = decideNotification({ kind: "open", place, nowS, recent, quiet });
      if (decision.kind !== "skip") {
        await fireNotification(decision.title, decision.body);
      }
      recent = decision.recent;
    } else {
      const ctx = getEntryById(placesRepo, db, eff.entryId);
      if (!ctx) continue;
      const { place, durationS } = ctx;
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

      // After a successful close, check whether this entry pushed the
      // place's running day/week totals past its configured target. If
      // yes, and we haven't already fired the corresponding "goal reached"
      // notification for this period, fire it now.
      await goalsNotifier(place, db, kv, nowS, fireNotification);
    }
  }

  writeRecent(kv, recent);
}

/**
 * Look up the entry and its place for a close_entry effect. Returns null
 * if the entry was deleted before we got here — we'd rather skip the
 * notification than crash.
 */
function getEntryById(
  placesRepo: PlacesRepo,
  db: AnyDb,
  entryId: string,
): { place: Place; durationS: number } | null {
  const entries = new EntriesRepo(db);
  const entry = entries.get(entryId);
  if (!entry) return null;
  const place = placesRepo.get(entry.placeId);
  if (!place) return null;
  const endedAt = entry.endedAt ?? getNowS();
  return { place, durationS: endedAt - entry.startedAt };
}
