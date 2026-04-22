import { createTestDb } from "@/db/testClient";
import { EntriesRepo } from "@/db/repository/entries";
import { PlacesRepo } from "@/db/repository/places";
import { KvRepo } from "@/db/repository/kv";
import { DAY_S } from "@/lib/time";
import {
  runRetentionSweep,
  RETENTION_KV_HARD_CAP_DAYS,
  RETENTION_KV_LAST_SWEEP_AT,
} from "../retention";

function setup() {
  const db = createTestDb();
  const places = new PlacesRepo(db);
  const entries = new EntriesRepo(db);
  const kv = new KvRepo(db);
  const p = places.create({ name: "Home", address: "s", latitude: 0, longitude: 0 });
  return { db, entries, kv, placeId: p.id };
}

describe("runRetentionSweep", () => {
  it("purges soft-deleted entries whose tombstone is older than 30 days", () => {
    const { entries, kv, placeId } = setup();
    const now = 100_000_000;
    const old = entries.createManual({
      placeId,
      startedAt: now - 40 * DAY_S,
      endedAt: now - 40 * DAY_S + 3600,
    });
    entries.softDelete(old.id);
    // We can't backdate `deletedAt` through the repo API, so rebuild an
    // EntriesRepo with a low-clock clock and re-soft-delete. This sets the
    // tombstone to a timestamp older than the sweep cutoff.
    const oldClockRepo = new EntriesRepo(
      (entries as unknown as { db: ConstructorParameters<typeof EntriesRepo>[0] }).db,
      { now: () => now - 40 * DAY_S },
    );
    oldClockRepo.softDelete(old.id);
    const r = runRetentionSweep(entries, kv, now);
    expect(r.skipped).toBe(false);
    expect(r.sweptSoftDeleted).toBeGreaterThanOrEqual(1);
    expect(entries.get(old.id)).toBeNull();
  });

  it("skips when a sweep already ran within the last day", () => {
    const { entries, kv } = setup();
    const now = 100_000_000;
    kv.set(RETENTION_KV_LAST_SWEEP_AT, String(now - 3600));
    const r = runRetentionSweep(entries, kv, now);
    expect(r.skipped).toBe(true);
    expect(r.sweptSoftDeleted).toBe(0);
    expect(r.sweptByAge).toBe(0);
  });

  it("honors hard-cap days when the KV flag is set", () => {
    const { entries, kv, placeId } = setup();
    const now = 100_000_000;
    const ancient = entries.createManual({
      placeId,
      startedAt: now - 400 * DAY_S,
      endedAt: now - 400 * DAY_S + 3600,
    });
    const recent = entries.createManual({
      placeId,
      startedAt: now - 5 * DAY_S,
      endedAt: now - 5 * DAY_S + 3600,
    });
    kv.set(RETENTION_KV_HARD_CAP_DAYS, "365");
    const r = runRetentionSweep(entries, kv, now);
    expect(r.sweptByAge).toBe(1);
    expect(entries.get(ancient.id)).toBeNull();
    expect(entries.get(recent.id)).not.toBeNull();
  });

  it("never touches an ongoing (endedAt null) entry, even past the hard cap", () => {
    const { entries, kv, placeId } = setup();
    const now = 100_000_000;
    const ongoing = entries.open({
      placeId,
      source: "auto",
      startedAt: now - 500 * DAY_S,
    });
    kv.set(RETENTION_KV_HARD_CAP_DAYS, "30");
    const r = runRetentionSweep(entries, kv, now);
    expect(r.sweptByAge).toBe(0);
    expect(entries.get(ongoing.id)).not.toBeNull();
  });
});
