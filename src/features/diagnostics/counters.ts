import type { KvRepo } from "@/db/repository/kv";

// Privacy-preserving local counters. Zero PII, zero network, zero
// timestamps — just integer tallies persisted to the KV table. They surface
// in the diagnostic export so the developer can ask a beta tester "how
// many entries did you create?" without collecting telemetry.
//
// Adding a new event: (1) add to CounterEvent below, (2) call bumpCounter /
// bumpFirst from the one site that matters, (3) nothing else.

const KV_COUNTERS = "diagnostics.counters";

export type CounterEvent =
  /** App opened (foreground) — increments on every cold/warm boot. */
  | "app_launch"
  /** User saved their very first place — emitted once per install. */
  | "first_place"
  /** User's first entry landed — auto or manual. Emitted once per install. */
  | "first_entry"
  /** Pro entitlement became active for the first time. */
  | "pro_granted"
  /** Paywall sheet opened — regardless of outcome. */
  | "paywall_shown";

export type Counters = Partial<Record<CounterEvent, number>>;

/** Read the current counter map. Returns an empty object when nothing set. */
export function readCounters(kv: KvRepo): Counters {
  const raw = kv.get(KV_COUNTERS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Counters = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k as CounterEvent] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Atomically increment one counter. Returns the new value.
 *
 * Counters are best-effort funnel telemetry — two concurrent writers from
 * separate JS contexts (foreground + background task) could race across
 * read→write. A missed increment every few months is acceptable.
 */
export function bumpCounter(kv: KvRepo, event: CounterEvent, by = 1): number {
  const current = readCounters(kv);
  const next = (current[event] ?? 0) + by;
  current[event] = next;
  kv.set(KV_COUNTERS, JSON.stringify(current));
  return next;
}

/**
 * Increment a counter only the first time it's emitted. Cheap idempotent
 * probe — used for "first_entry" / "first_place" which fire on every
 * create call and should record exactly once.
 */
export function bumpFirst(kv: KvRepo, event: CounterEvent): boolean {
  const current = readCounters(kv);
  if ((current[event] ?? 0) > 0) return false;
  current[event] = 1;
  kv.set(KV_COUNTERS, JSON.stringify(current));
  return true;
}

/**
 * Device-bound convenience wrappers. Swallow errors because counters are
 * best-effort telemetry — a missed increment must never crash a hook or
 * boot path. Hooks / screens call these; unit tests still use the explicit
 * {@link bumpCounter} / {@link bumpFirst} forms with an explicit KV.
 */
export function bumpCounterSafely(event: CounterEvent, by = 1): void {
  try {
    const kv = getDeviceKv();
    if (kv) bumpCounter(kv, event, by);
  } catch {
    // Intentional: telemetry is observational, not load-bearing.
  }
}

export function bumpFirstSafely(event: CounterEvent): void {
  try {
    const kv = getDeviceKv();
    if (kv) bumpFirst(kv, event);
  } catch {
    // Intentional: telemetry is observational, not load-bearing.
  }
}

let cachedDeviceKv: KvRepo | null = null;
function getDeviceKv(): KvRepo | null {
  if (cachedDeviceKv) return cachedDeviceKv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepo: Ctor } = require("@/db/repository/kv") as {
      KvRepo: new (db: unknown) => KvRepo;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as { db: unknown };
    cachedDeviceKv = new Ctor(db);
    return cachedDeviceKv;
  } catch {
    return null;
  }
}

/** Reset — test-only. Not exposed in UI; the diagnostic export is read-only. */
export function __resetCountersForTests(kv: KvRepo): void {
  kv.delete(KV_COUNTERS);
  cachedDeviceKv = null;
}
