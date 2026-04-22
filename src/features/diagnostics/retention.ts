import type { EntriesRepo } from "@/db/repository/entries";
import type { KvRepo } from "@/db/repository/kv";
import { DAY_S } from "@/lib/time";

const KV_LAST_SWEEP_AT = "retention.last_sweep_at_s";
const KV_HARD_RETENTION_DAYS = "retention.hard_cap_days";

// Soft-deleted rows disappear permanently after 30 days. The Undo affordance
// only lives a few seconds anyway, so 30 days is a generous safety net —
// hard-cap isn't needed for the user-visible UX.
const SOFT_DELETE_RETENTION_S = 30 * DAY_S;

// Don't run the sweep more often than once per 24 h. Cheap sanity gate so
// repeated app foregrounds don't hammer the DB.
const MIN_INTERVAL_BETWEEN_SWEEPS_S = DAY_S;

export type RetentionResult = {
  sweptSoftDeleted: number;
  sweptByAge: number;
  skipped: boolean;
};

/**
 * Best-effort retention pass. Two phases:
 *
 *  1. Always: hard-purge soft-deleted entries whose tombstone is older
 *     than 30 days. Invisible to the user — the Undo chip has long
 *     expired by then.
 *
 *  2. Optional: if the user has set `retention.hard_cap_days` in KV,
 *     hard-delete entries whose `startedAt` is older than that window.
 *     Keeps only ended entries — the currently-running entry is never
 *     touched. This flag has no UI today; see the README's v2 roadmap.
 *
 * Rate-limited to once per day via `retention.last_sweep_at_s` so foreground
 * cycles don't thrash the DB.
 */
export function runRetentionSweep(
  entriesRepo: EntriesRepo,
  kv: KvRepo,
  nowS: number,
): RetentionResult {
  const lastRaw = kv.get(KV_LAST_SWEEP_AT);
  const last = lastRaw ? Number(lastRaw) : 0;
  if (Number.isFinite(last) && nowS - last < MIN_INTERVAL_BETWEEN_SWEEPS_S) {
    return { sweptSoftDeleted: 0, sweptByAge: 0, skipped: true };
  }

  const sweptSoftDeleted = entriesRepo.purgeSoftDeletedBefore(nowS - SOFT_DELETE_RETENTION_S);

  let sweptByAge = 0;
  const hardCapRaw = kv.get(KV_HARD_RETENTION_DAYS);
  if (hardCapRaw) {
    const days = Number(hardCapRaw);
    if (Number.isFinite(days) && days > 0) {
      sweptByAge = entriesRepo.purgeOlderThan(nowS - days * DAY_S);
    }
  }

  kv.set(KV_LAST_SWEEP_AT, String(nowS));
  return { sweptSoftDeleted, sweptByAge, skipped: false };
}

/** KV key constants exported so tests can inspect the last-sweep timestamp. */
export const RETENTION_KV_LAST_SWEEP_AT = KV_LAST_SWEEP_AT;
export const RETENTION_KV_HARD_CAP_DAYS = KV_HARD_RETENTION_DAYS;
