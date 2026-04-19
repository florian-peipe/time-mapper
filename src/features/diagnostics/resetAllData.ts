import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { entries, kv, pendingTransitions, places } from "@/db/schema";
import { unregisterAllGeofences } from "@/features/tracking/geofenceService";

type AnyDb = BetterSQLite3Database | ExpoSQLiteDatabase;

/**
 * Nuke every domain row in the local database and unregister any active
 * geofences. Caller is responsible for routing the user back through
 * onboarding (`useOnboardingGate().reset()`) and for relaunching the app
 * if there's any non-DB in-memory state that needs to flush.
 *
 * No confirmation — that's the caller's job. Intended to be wired behind
 * an explicit two-step destructive Alert in Settings.
 */
export async function resetAllData(db: AnyDb): Promise<void> {
  // Delete in FK-safe order: entries + pending reference places; kv is free-standing.
  db.delete(entries).run();
  db.delete(pendingTransitions).run();
  db.delete(places).run();
  db.delete(kv).run();
  // Best-effort: unregister any OS-level geofences. Failure is silent — the
  // data is already gone from our DB, which is what the user asked for.
  try {
    await unregisterAllGeofences();
  } catch {
    // Ignore — the native API might be unavailable (permissions revoked,
    // simulator without geofence support, etc.).
  }
}
