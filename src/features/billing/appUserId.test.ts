/**
 * Tests for the anon RevenueCat user-id helper. The user-id is a UUID we
 * generate on first launch and persist in the KV store under
 * `revenuecat.user_id`. RC then uses it as the appUserID for the lifetime
 * of the install (and on the same Apple/Google account, across reinstalls
 * thanks to keychain-backed restore).
 */
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import { REVENUECAT_USER_ID_KEY, getOrCreateRevenueCatUserId } from "./appUserId";

function makeRepo(): KvRepo {
  return new KvRepo(createTestDb());
}

describe("getOrCreateRevenueCatUserId", () => {
  it("creates a fresh UUID on first call", () => {
    const repo = makeRepo();
    const id = getOrCreateRevenueCatUserId(repo);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // Persisted under the canonical key.
    expect(repo.get(REVENUECAT_USER_ID_KEY)).toBe(id);
  });

  it("returns the same UUID on subsequent calls (stable across launches)", () => {
    const repo = makeRepo();
    const first = getOrCreateRevenueCatUserId(repo);
    const second = getOrCreateRevenueCatUserId(repo);
    const third = getOrCreateRevenueCatUserId(repo);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("respects an existing pre-seeded value (migration / external setter)", () => {
    const repo = makeRepo();
    repo.set(REVENUECAT_USER_ID_KEY, "pre-seeded-123");
    expect(getOrCreateRevenueCatUserId(repo)).toBe("pre-seeded-123");
  });

  it("two distinct repos produce distinct IDs (e.g. two test installs)", () => {
    const a = getOrCreateRevenueCatUserId(makeRepo());
    const b = getOrCreateRevenueCatUserId(makeRepo());
    expect(a).not.toBe(b);
  });
});
