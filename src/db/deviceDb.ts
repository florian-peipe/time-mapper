import type * as DbClientModule from "./client";

type AnyDb = DbClientModule.AnyDb;

let cachedDb: AnyDb | null = null;

/**
 * Lazy accessor for the device `db` singleton. Defers the `expo-sqlite`
 * native binding import until a device-backed caller actually needs it —
 * keeps Jest's import graph free of the native module. Idempotent: the
 * underlying `require("@/db/client")` runs at most once per process.
 *
 * Centralizing the lazy require here is why every feature hook doesn't
 * need its own `eslint-disable @typescript-eslint/no-require-imports`.
 */
export function getDeviceDb(): AnyDb {
  if (cachedDb) return cachedDb;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("./client") as typeof DbClientModule;
  cachedDb = mod.db;
  return cachedDb;
}

/**
 * Build a lazy, cached accessor for a device-scoped repo. Returns a getter
 * that constructs `make(db)` the first time it's called and returns the
 * same instance on subsequent calls. Pattern:
 *
 *     const getDeviceKvRepo = createDeviceRepo((db) => new KvRepo(db));
 *     // later, inside a hook:
 *     const repo = getDeviceKvRepo();
 */
export function createDeviceRepo<T>(make: (db: AnyDb) => T): () => T {
  let cached: T | null = null;
  return () => {
    if (cached) return cached;
    cached = make(getDeviceDb());
    return cached;
  };
}

/** Reset the cached device db/repos — test-only. */
export function __resetDeviceDbForTests(): void {
  cachedDb = null;
}
