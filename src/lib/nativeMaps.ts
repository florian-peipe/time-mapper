import type React from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Shape of the subset of `react-native-maps` we use. Typed loosely so the
 * dynamic require doesn't pull in the native ESM types on platforms where
 * the module can't resolve.
 */
export type MapModule = {
  default: React.ComponentType<Record<string, unknown>>;
  Marker: React.ComponentType<Record<string, unknown>>;
  Circle: React.ComponentType<Record<string, unknown>>;
  PROVIDER_DEFAULT?: unknown;
};

/**
 * Dynamic import of `react-native-maps`. Expo Go (without a custom dev
 * client) doesn't bundle the native module; Jest can't resolve the ESM
 * re-exports through our module transform ignore list. Callers should
 * render a Banner fallback when this returns null.
 */
export function tryLoadNativeMaps(): MapModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-maps") as MapModule;
  } catch {
    return null;
  }
}

/**
 * Android's `react-native-maps` talks to the Google Maps for Android SDK,
 * which needs a (free-tier) key at `app.json → android.config.googleMaps.apiKey`.
 * Without it the native MapView mounts but its GL surface fails to init and
 * the sheet appears frozen — callers fall back to a Banner.
 *
 * iOS uses Apple Maps natively (free, no key).
 *
 * Note: this is the Maps *SDK* key, not a Places/Geocoding key. Autocomplete
 * uses Photon (OSM/Komoot) — no Google API involvement there.
 */
export function isNativeMapUsable(): boolean {
  if (Platform.OS !== "android") return true;
  const cfg = Constants.expoConfig?.android?.config as
    | { googleMaps?: { apiKey?: unknown } }
    | undefined;
  const key = cfg?.googleMaps?.apiKey;
  return typeof key === "string" && key.length > 0;
}
