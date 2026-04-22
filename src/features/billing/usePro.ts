/**
 * Pro-entitlement hook backed by RevenueCat. Subscribes to live customer-info
 * updates so out-of-band renewals or store events flip `isPro` without a
 * manual refresh.
 *
 * Source of truth: the RC SDK. There is no local "mock" state — dev builds
 * without API keys fail loudly at `configureRevenueCat` time so the missing
 * wiring surfaces immediately. Tests override via `__setProForTests`.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import { getOrCreateRevenueCatUserIdFromDevice } from "./appUserId";
import {
  configureRevenueCat,
  getCustomerInfo,
  getOfferings,
  isProActive,
  onCustomerInfoUpdate,
  purchasePackage,
  restorePurchases,
} from "./revenuecat";

export type UseProResult = {
  /** Whether the user currently has an active Pro entitlement. */
  isPro: boolean;
  /** True until the initial customer-info + offerings round-trip settles. */
  loading: boolean;
  /** The RevenueCat offering (with monthly/annual packages) or null. */
  offerings: PurchasesOffering | null;
  /** Execute a real purchase. Resolves on success, throws on cancel/error. */
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  /** Restore prior purchases for the current Apple/Google account. */
  restore: () => Promise<void>;
};

// Test-only override surface — Jest sets this via `__setProForTests` so
// screen tests can render as Pro without spinning up the full RC flow.
// When null (the default), `usePro` reads the real SDK. Subscribers are
// notified via the version counter so changes re-render components
// mid-test (mirrors the customer-info update listener in production).
let proOverride: boolean | null = null;
let overrideVersion = 0;
const overrideSubs = new Set<() => void>();

/** Test-only — set a Pro override (true/false) or clear it with null. */
export function __setProForTests(v: boolean | null): void {
  proOverride = v;
  overrideVersion++;
  for (const cb of overrideSubs) cb();
}

function subscribeOverride(cb: () => void): () => void {
  overrideSubs.add(cb);
  return () => overrideSubs.delete(cb);
}

function getOverrideSnapshot(): number {
  return overrideVersion;
}

/**
 * Hook for components that need the user's Pro state. Subscribes to live
 * customer-info updates so out-of-band renewals or store events flip
 * `isPro` without a manual refresh.
 */
export function usePro(): UseProResult {
  // Subscribe to the test override store so flips propagate to components.
  // In production the store is never written; this is a zero-cost subscription.
  useSyncExternalStore(subscribeOverride, getOverrideSnapshot, getOverrideSnapshot);

  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);

  // Track mount status so async fetches don't write to a torn-down hook.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Resolve a stable anon user-id from the KV store (or mint one on
    // first launch) and feed it to RC so entitlements survive reinstalls
    // on the same Apple/Google account. Wrapped in try/catch because the
    // device DB may not yet be migrated in degenerate boot orders — we
    // fall back to anonymous configure rather than blocking billing on
    // a fixable infra hiccup.
    let userId: string | undefined;
    try {
      userId = getOrCreateRevenueCatUserIdFromDevice();
    } catch (err) {
      console.warn("usePro: anon user-id resolve failed, using anonymous", err);
    }

    // Configure is idempotent — safe to call from every consumer's effect.
    // The actual SDK init runs at most once per process.
    try {
      configureRevenueCat(userId);
    } catch (err) {
      console.warn("usePro: configureRevenueCat failed", err);
      if (mounted.current) setLoading(false);
      return () => {
        mounted.current = false;
      };
    }

    // Initial fetch: customer info + offerings in parallel. Each branch
    // sets state independently so a slow offerings call doesn't block
    // `isPro` from reflecting a known-pro user.
    void (async () => {
      try {
        const [info, off] = await Promise.all([getCustomerInfo(), getOfferings()]);
        if (!mounted.current) return;
        setIsPro(isProActive(info));
        setOfferings(off);
      } catch (err) {
        // Swallow — the SDK may be momentarily unreachable. Subsequent
        // listener events will reconcile state. We still log so dev sees it.
        console.warn("usePro: initial fetch failed", err);
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();

    // Live updates from the SDK (renewal, refund, RC dashboard push).
    const unsubscribe = onCustomerInfoUpdate((info) => {
      if (!mounted.current) return;
      setIsPro(isProActive(info));
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const info = await purchasePackage(pkg);
    setIsPro(isProActive(info));
  }, []);

  const restore = useCallback(async () => {
    const info = await restorePurchases();
    setIsPro(isProActive(info));
  }, []);

  // Apply the test override on read so both the initial + update-listener
  // state flows can still run without interference — tests only care about
  // the final `isPro` value components see.
  return {
    isPro: proOverride ?? isPro,
    loading: proOverride != null ? false : loading,
    offerings,
    purchase,
    restore,
  };
}
