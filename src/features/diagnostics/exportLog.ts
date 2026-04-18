// Dev-only diagnostic log exporter. Dumps the last N pending transitions, the
// last geofence events from AsyncStorage (if available), the anon user-id, and
// the app version into a JSON file, then invokes the platform share sheet.
//
// This is intentionally small — it's a bug-report aid, not a structured log
// pipeline. If the expo-file-system / Sharing modules aren't available
// (headless Jest, Expo Go without the right modules) we log the payload to
// the console instead.

import { Platform } from "react-native";

export type DiagnosticPayload = {
  generatedAt: string;
  platform: string;
  appVersion: string;
  anonUserId?: string;
  pendingTransitions: unknown[];
  recentEvents: unknown[];
  environment: {
    hasPlacesKey: boolean;
    hasRevenueCatIos: boolean;
    hasRevenueCatAndroid: boolean;
    hasSentryDsn: boolean;
  };
};

/**
 * Build the payload object. Pure so a test can assert the shape without
 * tripping expo-file-system.
 */
export function buildDiagnosticPayload(extra: Partial<DiagnosticPayload> = {}): DiagnosticPayload {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    platform: Platform.OS,
    appVersion: extra.appVersion ?? "1.0.0",
    anonUserId: extra.anonUserId,
    pendingTransitions: extra.pendingTransitions ?? [],
    recentEvents: extra.recentEvents ?? [],
    environment: extra.environment ?? {
      hasPlacesKey: !!process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
      hasRevenueCatIos: !!process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      hasRevenueCatAndroid: !!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      hasSentryDsn: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
    },
  };
}

/**
 * Write the diagnostic payload to a temp JSON file and invoke the platform
 * share sheet. Falls back to console.log when the native modules aren't
 * available (Expo Go, Jest).
 */
export async function exportDiagnosticLog(extra: Partial<DiagnosticPayload> = {}): Promise<void> {
  const payload = buildDiagnosticPayload(extra);
  const json = JSON.stringify(payload, null, 2);

  // eslint-disable-next-line no-console
  console.log("[diagnostics]", json);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require("expo-file-system") as {
      documentDirectory?: string | null;
      writeAsStringAsync?: (uri: string, data: string) => Promise<void>;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require("expo-sharing") as {
      isAvailableAsync?: () => Promise<boolean>;
      shareAsync?: (uri: string, opts?: Record<string, unknown>) => Promise<void>;
    };
    const dir = FileSystem.documentDirectory;
    if (!dir || !FileSystem.writeAsStringAsync) return;
    const uri = `${dir}time-mapper-diagnostics-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(uri, json);
    if (Sharing.isAvailableAsync && (await Sharing.isAvailableAsync()) && Sharing.shareAsync) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Time Mapper diagnostics",
      });
    }
  } catch {
    // Share/file-system not available — console.log above is the only exit.
  }
}
