// Diagnostic log exporter. Dumps the last N pending transitions, the last
// geofence events (if available), the anon user-id, and the app version into
// a JSON file, then invokes the platform share sheet.
//
// This is a bug-report aid and a production-visible feature (surfaced under
// Settings → Data → Export diagnostic log). `expo-file-system` and
// `expo-sharing` are managed-workflow standard — we import them directly
// instead of the try/require dance we used pre-v0.6.1.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

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
  const manifestVersion =
    (Constants.expoConfig as { version?: string } | null | undefined)?.version ?? "unknown";
  return {
    generatedAt: now,
    platform: Platform.OS,
    appVersion: extra.appVersion ?? manifestVersion,
    anonUserId: extra.anonUserId,
    pendingTransitions: extra.pendingTransitions ?? loadPendingTransitionsSafely(),
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
 * Best-effort read of the latest pending transitions from the device repo.
 * On test/Expo-Go paths where the SQLite binding is unavailable we return
 * an empty array — the diagnostic still exports something useful
 * (platform, env, app version).
 */
function loadPendingTransitionsSafely(): unknown[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PendingTransitionsRepo } = require("@/db/repository/pending") as {
      PendingTransitionsRepo: new (db: unknown) => { listAll: () => unknown[] };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as { db: unknown };
    const repo = new PendingTransitionsRepo(db);
    // Cap at 50 rows — diagnostic files stay human-readable.
    return repo.listAll().slice(0, 50);
  } catch {
    return [];
  }
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
    const dir = (FileSystem as unknown as { documentDirectory?: string | null }).documentDirectory;
    if (!dir) return;
    const uri = `${dir}time-mapper-diagnostics-${Date.now()}.json`;
    await (
      FileSystem as unknown as {
        writeAsStringAsync: (uri: string, data: string) => Promise<void>;
      }
    ).writeAsStringAsync(uri, json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Time Mapper diagnostics",
      });
    }
  } catch (err) {
    // Share/file-system failed — console.log above is the only exit.
    console.warn("[diagnostics] export failed", err);
  }
}
