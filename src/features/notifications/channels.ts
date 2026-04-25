/**
 * One-time setup for iOS notification categories + Android notification
 * channels. Called from `bootstrapTracking` on every boot; guarded by a
 * KV flag so the native config is only POSTed once.
 */
import { Platform } from "react-native";
import type * as ExpoNotifications from "expo-notifications";
import type { KvRepo } from "@/db/repository/kv";
import { captureException } from "@/lib/crash";
import { i18n } from "@/lib/i18n";
import { KV_KEYS } from "@/db/kvKeys";

export const ANDROID_CHANNEL_ID = "timemapper-tracking";
export const IOS_CATEGORY_ID = "timemapper-tracking";

function getNotifications(): typeof ExpoNotifications {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as typeof ExpoNotifications;
}

/**
 * Idempotent. Safe to call on every boot — bails out early when the KV
 * flag says we've already configured. Errors are swallowed so a notification
 * subsystem failure doesn't break app boot.
 */
export async function configureNotificationChannels(kv: KvRepo): Promise<void> {
  if (kv.get(KV_KEYS.NOTIFIER_CHANNELS_CONFIGURED) === "1") return;
  try {
    const N = getNotifications();
    await N.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: i18n.t("notifier.channel.name"),
      importance: N.AndroidImportance.LOW,
      vibrationPattern: [0, 100, 0, 100],
      lightColor: "#FF7A1A",
    });
    // iOS categories only — Android's setNotificationCategoryAsync rejects
    // an empty actions array; we don't attach action buttons on Android.
    if (Platform.OS === "ios") {
      await N.setNotificationCategoryAsync(IOS_CATEGORY_ID, []);
    }
    kv.set(KV_KEYS.NOTIFIER_CHANNELS_CONFIGURED, "1");
  } catch (err) {
    captureException(err, { scope: "notifications.channels" });
  }
}
