/**
 * Anon user-id management for RevenueCat. RC needs a stable identifier so
 * that:
 *   1. entitlements survive an app reinstall on the same Apple/Google
 *      account (RC links purchases to the appUserID the device used at
 *      purchase time);
 *   2. analytics can correlate sessions belonging to the same user
 *      across launches.
 *
 * We mint a v4 UUID on first launch and store it in the KV table under
 * `revenuecat.user_id`. The same value is then handed to
 * `configureRevenueCat(userId)` on every subsequent boot — RC treats this
 * as an "anonymous-but-stable" ID (no PII attached, but persistent).
 */
import type * as DbClientModule from "@/db/client";
import { KvRepo } from "@/db/repository/kv";
import { uuid } from "@/lib/id";

/** Canonical KV key. Don't rename — would orphan existing installs' IDs. */
export const REVENUECAT_USER_ID_KEY = "revenuecat.user_id";

/**
 * Read the persisted RevenueCat anon user-id, creating one if absent.
 * Sync — relies on the synchronous `KvRepo` API (better-sqlite3 / expo-sqlite
 * sync get/set). Safe to call from a React effect with no await.
 */
export function getOrCreateRevenueCatUserId(repo: KvRepo): string {
  const existing = repo.get(REVENUECAT_USER_ID_KEY);
  if (existing && existing.length > 0) return existing;
  const fresh = uuid();
  repo.set(REVENUECAT_USER_ID_KEY, fresh);
  return fresh;
}

/**
 * Convenience: resolve the device-bound KV repo (cached) and look up / mint
 * the RevenueCat user-id in one call. This is what `usePro` calls on boot;
 * unit tests mock this entire function so the device DB is never touched.
 */
let cachedDeviceKv: KvRepo | null = null;
export function getOrCreateRevenueCatUserIdFromDevice(): string {
  if (!cachedDeviceKv) {
    // Deferred require so jest never tries to load expo-sqlite when this
    // module is mocked at the boundary in screen / hook tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as typeof DbClientModule;
    cachedDeviceKv = new KvRepo(db);
  }
  return getOrCreateRevenueCatUserId(cachedDeviceKv);
}

/** Test-only — wipes the cached repo so tests can swap the underlying DB. */
export function _resetDeviceKvCacheForTest(): void {
  cachedDeviceKv = null;
}
