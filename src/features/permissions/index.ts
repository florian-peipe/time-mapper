import * as Location from "expo-location";
import type * as ExpoNotifications from "expo-notifications";

/**
 * Normalized permission status. We collapse expo's separate foreground /
 * background responses into one value per resource so UI code doesn't have
 * to re-derive it. "foreground-only" is meaningful for location: the app
 * can track while open but auto-tracking is off.
 */
export type LocationPermissionStatus =
  | "granted" // always + when-in-use
  | "foreground-only"
  | "denied"
  | "undetermined";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

function getNotifications(): typeof ExpoNotifications {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as typeof ExpoNotifications;
}

/**
 * Fetches the current location permission status without prompting. Used
 * when the app starts to decide whether to show the Timeline "needs
 * permissions" banner.
 */
export async function getLocationStatus(): Promise<LocationPermissionStatus> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return fg.status === "undetermined" ? "undetermined" : "denied";
  }
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === "granted") return "granted";
  return "foreground-only";
}

/**
 * Prompt for foreground location. Returns the resulting status — never
 * throws. On iOS this is the first of a two-step flow; the OS will not
 * let us ask for Always on the first prompt.
 */
export async function requestForegroundLocation(): Promise<LocationPermissionStatus> {
  try {
    const r = await Location.requestForegroundPermissionsAsync();
    if (r.status === "granted") {
      const bg = await Location.getBackgroundPermissionsAsync();
      return bg.status === "granted" ? "granted" : "foreground-only";
    }
    return r.status === "undetermined" ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

/**
 * Prompt for background location. On iOS this is the "Change to Always"
 * secondary prompt. Only returns "granted" if the user picked Always.
 */
export async function requestBackgroundLocation(): Promise<LocationPermissionStatus> {
  try {
    const r = await Location.requestBackgroundPermissionsAsync();
    if (r.status === "granted") return "granted";
    // Even if background was denied, foreground may still be granted.
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status === "granted") return "foreground-only";
    return r.status === "undetermined" ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

export async function getNotificationsStatus(): Promise<NotificationPermissionStatus> {
  try {
    const N = getNotifications();
    const r = await N.getPermissionsAsync();
    if (r.status === "granted") return "granted";
    return r.status === "undetermined" ? "undetermined" : "denied";
  } catch {
    return "undetermined";
  }
}

export async function requestNotifications(): Promise<NotificationPermissionStatus> {
  try {
    const N = getNotifications();
    const r = await N.requestPermissionsAsync();
    if (r.status === "granted") return "granted";
    return r.status === "undetermined" ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}
