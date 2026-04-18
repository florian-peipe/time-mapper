// Crash reporting — opt-in via `EXPO_PUBLIC_SENTRY_DSN`. When the DSN is
// present AND `@sentry/react-native` is installed, we initialize Sentry and
// route unhandled errors + explicit `captureException` calls to the dashboard.
// When either is missing we no-op and log once at boot so devs know why
// crash reporting isn't showing up.
//
// Why a lazy require? `@sentry/react-native` is a heavy native dep that's
// optional for hobbyist builds. The same "works without a key" posture we use
// for RevenueCat + Google Places applies here: the app bundles fine without
// the module, and production builds that want Sentry can `npm install
// @sentry/react-native` alongside setting the DSN.

type SentryLike = {
  init: (opts: {
    dsn: string;
    tracesSampleRate?: number;
    beforeSend?: (event: unknown) => unknown;
  }) => void;
  captureException: (err: unknown, opts?: { extra?: Record<string, unknown> }) => void;
  setUser: (user: { id: string } | null) => void;
};

let sentry: SentryLike | null = null;
let initialized = false;
let warnedNoDsn = false;

function getDsn(): string {
  return process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
}

export function isCrashReportingEnabled(): boolean {
  return initialized && sentry != null;
}

/**
 * Initialize Sentry if the DSN + module are available. Safe to call more
 * than once — subsequent calls become no-ops. Call from `_layout.tsx` boot.
 */
export function initCrashReporting(): void {
  if (initialized) return;
  const dsn = getDsn();
  if (!dsn) {
    if (!warnedNoDsn) {
      // eslint-disable-next-line no-console
      console.info(
        "[crash] Sentry DSN not set — crash reporting disabled. Set EXPO_PUBLIC_SENTRY_DSN to enable.",
      );
      warnedNoDsn = true;
    }
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@sentry/react-native") as SentryLike;
    mod.init({
      dsn,
      // Low sample rate — performance tracing rarely surfaces actionable
      // issues for a consumer app this simple.
      tracesSampleRate: 0.1,
      // PII scrubber: strip coordinates from breadcrumbs + any event data.
      // RevenueCat anon user-id is the only user identifier we pass along;
      // we never forward the email/name.
      beforeSend: (event: unknown) => scrubLocation(event),
    });
    sentry = mod;
    initialized = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.info(
      "[crash] @sentry/react-native not installed — skipping crash reporting.",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Tag the current session with the anonymous RevenueCat user-id. Used so
 * Sentry groups crashes by install without ever learning the user's name.
 */
export function identifyAnonUser(anonId: string | null): void {
  if (!sentry) return;
  sentry.setUser(anonId ? { id: anonId } : null);
}

/**
 * Report a caught error. Works even when Sentry is disabled — in that case
 * we just console.error so the error still shows in the dev log.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentry) {
    console.error("[crash] captureException (no Sentry):", err, context);
    return;
  }
  sentry.captureException(err, context ? { extra: context } : undefined);
}

/**
 * Strip obvious PII from a Sentry event. Currently:
 * - drops `location` keys from breadcrumbs,
 * - drops `latitude`/`longitude` from extra.
 * Returns the event (may be mutated). Returning `null` tells Sentry to drop
 * the event entirely — we don't do that here but callers can extend.
 */
export function scrubLocation(event: unknown): unknown {
  if (!event || typeof event !== "object") return event;
  const e = event as {
    breadcrumbs?: { data?: Record<string, unknown> }[];
    extra?: Record<string, unknown>;
  };
  if (Array.isArray(e.breadcrumbs)) {
    for (const b of e.breadcrumbs) {
      if (b.data) {
        delete b.data.location;
        delete b.data.latitude;
        delete b.data.longitude;
      }
    }
  }
  if (e.extra) {
    delete e.extra.latitude;
    delete e.extra.longitude;
    delete e.extra.location;
  }
  return event;
}

/** Reset module-level state — test-only. */
export function __resetForTests(): void {
  sentry = null;
  initialized = false;
  warnedNoDsn = false;
}
