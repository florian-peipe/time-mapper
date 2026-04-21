// Diagnostic log exporter. Dumps the last N pending transitions, the last
// geofence events (if available), the anon user-id, and the app version into
// a JSON file, then invokes the platform share sheet.
//
// This is a bug-report aid and a production-visible feature (surfaced under
// Settings → Data → Export diagnostic log).

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Counters } from "./counters";

// expo-file-system v19 hides the classic functional API behind a non-typed
// default — cast once so the call-sites stay compact.
type LegacyFs = {
  documentDirectory?: string | null;
  writeAsStringAsync: (uri: string, data: string) => Promise<void>;
};

export type DiagnosticPayload = {
  generatedAt: string;
  platform: string;
  appVersion: string;
  anonUserId?: string;
  pendingTransitions: unknown[];
  recentEvents: unknown[];
  counters: Counters;
  environment: {
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
    counters: extra.counters ?? loadCountersSafely(),
    environment: extra.environment ?? {
      hasRevenueCatIos: !!process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      hasRevenueCatAndroid: !!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      hasSentryDsn: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
    },
  };
}

/** Best-effort counter read — same import guard as pending transitions. */
function loadCountersSafely(): Counters {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepo } = require("@/db/repository/kv") as {
      KvRepo: new (db: unknown) => unknown;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readCounters } = require("./counters") as {
      readCounters: (kv: unknown) => Counters;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as { db: unknown };
    return readCounters(new KvRepo(db));
  } catch {
    return {};
  }
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
 * share sheet. In development builds only (__DEV__), also logs the payload
 * to the console. Production builds never log diagnostics locally — the
 * user's only exit is the share sheet.
 */
export async function exportDiagnosticLog(extra: Partial<DiagnosticPayload> = {}): Promise<void> {
  const payload = buildDiagnosticPayload(extra);
  const json = JSON.stringify(payload, null, 2);

  // Dev-only dump. In production the user shares via the native share
  // sheet below; we never log their diagnostic blob to the device console
  // in a release build.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[diagnostics]", json);
  }

  try {
    const fs = FileSystem as unknown as LegacyFs;
    const dir = fs.documentDirectory;
    if (!dir) return;
    const uri = `${dir}time-mapper-diagnostics-${Date.now()}.json`;
    await fs.writeAsStringAsync(uri, json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Time Mapper diagnostics",
      });
    }
  } catch (err) {
    // Share/file-system failed — nothing else we can do cleanly here.
    // The __DEV__ console.log above is the only observable exit in dev;
    // in production the error is swallowed silently rather than nagging
    // the user with a technical toast they can't act on.
    if (__DEV__) {
      console.warn("[diagnostics] export failed", err);
    }
  }
}
