/**
 * Daily digest reminder — an opt-in daily notification at the user's chosen
 * hour ("Your daily summary is ready"). Separate from the tracking
 * open/close path because its scheduling is purely user-driven.
 */
import type * as ExpoNotifications from "expo-notifications";
import type { KvRepo } from "@/db/repository/kv";
import { captureException } from "@/lib/crash";
import { i18n } from "@/lib/i18n";
import { KV_KEYS } from "@/db/kvKeys";
import { IOS_CATEGORY_ID } from "./channels";

function getNotifications(): typeof ExpoNotifications {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as typeof ExpoNotifications;
}

/** Whether the daily digest is enabled. Default: false. */
export function getDailyDigestEnabled(kv: KvRepo): boolean {
  return kv.get(KV_KEYS.NOTIFIER_DIGEST_ENABLED) === "1";
}

/** Hour (0-23) the daily digest should fire. Default: 8. */
export function getDailyDigestHour(kv: KvRepo): number {
  const raw = kv.get(KV_KEYS.NOTIFIER_DIGEST_HOUR);
  const n = raw == null ? 8 : Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : 8;
}

/**
 * Turn the daily digest on / off. Persists the flag + hour to KV and
 * (re-)schedules the native daily notification. Existing schedule IDs are
 * cancelled first so duplicates don't accrue across flips.
 *
 * Body copy is static because the payload is pre-scheduled — the user
 * tapping the notification opens the app which then shows fresh data.
 */
export async function setDailyDigestSchedule(
  kv: KvRepo,
  opts: { enabled: boolean; hour: number },
): Promise<void> {
  const { enabled, hour } = opts;
  const clampedHour = Math.min(23, Math.max(0, Math.floor(hour)));
  kv.set(KV_KEYS.NOTIFIER_DIGEST_HOUR, String(clampedHour));

  // Always cancel any previously scheduled id before (re-)scheduling.
  const prevId = kv.get(KV_KEYS.NOTIFIER_DIGEST_ID);
  if (prevId) {
    try {
      await getNotifications().cancelScheduledNotificationAsync(prevId);
    } catch {
      // Ignore — the id may have been consumed already or the platform
      // may not expose cancellation; either way we'll overwrite below.
    }
    kv.delete(KV_KEYS.NOTIFIER_DIGEST_ID);
  }

  if (!enabled) {
    kv.delete(KV_KEYS.NOTIFIER_DIGEST_ENABLED);
    return;
  }

  kv.set(KV_KEYS.NOTIFIER_DIGEST_ENABLED, "1");
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
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: clampedHour,
        minute: 0,
      },
    });
    kv.set(KV_KEYS.NOTIFIER_DIGEST_ID, id);
  } catch (err) {
    captureException(err, { scope: "notifications.digest" });
  }
}
