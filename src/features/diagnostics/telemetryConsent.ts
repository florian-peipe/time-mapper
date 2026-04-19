import type * as KvModule from "@/db/repository/kv";

type KvRepo = InstanceType<typeof KvModule.KvRepo>;

const KV_TELEMETRY_ENABLED = "settings.telemetry_enabled";

/**
 * GDPR opt-in flag for crash-reporting (Sentry). Default: **disabled**. The
 * user must explicitly enable it from Settings. Read by `initCrashReporting`
 * at boot; flipped by `NotificationsSheet` / Settings row.
 *
 * The flag change takes effect on the **next** cold start — Sentry is
 * initialized once and has no public teardown API.
 */
export function getTelemetryEnabled(kv: KvRepo): boolean {
  return kv.get(KV_TELEMETRY_ENABLED) === "1";
}

export function setTelemetryEnabled(kv: KvRepo, enabled: boolean): void {
  if (enabled) kv.set(KV_TELEMETRY_ENABLED, "1");
  else kv.delete(KV_TELEMETRY_ENABLED);
}
