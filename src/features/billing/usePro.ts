/**
 * Production Pro-entitlement hook. Exposes the same `{ isPro, grant, revoke }`
 * surface as `useProMock` plus async-aware additions (`loading`, `offerings`,
 * `purchase`, `restore`) so screens can drive a real RevenueCat purchase
 * flow without prop-drilling SDK objects.
 *
 * Two backends:
 *   - **Real**: configures the SDK on first mount, fetches initial customer
 *     info + offerings, subscribes to live updates.
 *   - **Mock**: when `isMockMode()` reports the SDK has no API keys (dev
 *     workspace without RC dashboard), we delegate to the in-memory
 *     `useProMock` store so the rest of the app keeps working unchanged.
 *
 * Crucially: every consumer site (PaywallScreen, SettingsScreen,
 * StatsScreen, AddPlaceSheet) imports `usePro` and gets the same shape
 * either way. No conditional imports, no separate "dev" build mode.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import {
  configureRevenueCat,
  getCustomerInfo,
  getOfferings,
  isMockMode,
  isProActive,
  onCustomerInfoUpdate,
  purchasePackage,
  restorePurchases,
} from "./revenuecat";
import { useProMock } from "./useProMock";

export type UseProResult = {
  /** Whether the user currently has an active Pro entitlement. */
  isPro: boolean;
  /**
   * True until the initial `getCustomerInfo` + `getOfferings` round-trip
   * settles. In mock mode this is always false (nothing to fetch).
   */
  loading: boolean;
  /** The RevenueCat offering (with monthly/annual packages) or null. */
  offerings: PurchasesOffering | null;
  /** Execute a real purchase. Resolves on success, throws on cancel/error. */
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  /** Restore prior purchases for the current Apple/Google account. */
  restore: () => Promise<void>;
  /**
   * Dev-only: forces local Pro state to true. In real mode this warns and
   * does nothing — the source of truth is the SDK / store, not us.
   */
  grant: () => void;
  /** Dev-only mirror of `grant`. */
  revoke: () => void;
};

/**
 * Hook for components that need the user's Pro state. Subscribes to live
 * customer-info updates so out-of-band renewals or store events flip
 * `isPro` without a manual refresh.
 */
export function usePro(): UseProResult {
  // We must always call hooks in the same order. Decide which backend to use
  // *after* both hook trees are subscribed; we then conditionally surface
  // one set of values or the other.
  const mockBackend = useProMock();
  const realBackend = useRealPro();

  // `isMockMode()` is read once per render but the configure-time decision
  // happens inside `useRealPro` (which calls `configureRevenueCat()` in an
  // effect). Until that effect runs, `isMockMode()` may return false even
  // when the keys are missing — but that's fine because `loading` masks
  // the brief inconsistency on the consuming screens.
  if (isMockMode()) {
    return {
      isPro: mockBackend.isPro,
      loading: false,
      offerings: null,
      grant: mockBackend.grant,
      revoke: mockBackend.revoke,
      purchase: () =>
        Promise.reject(new Error("RevenueCat is in mock mode — purchase not available")),
      restore: () => Promise.resolve(),
    };
  }

  return realBackend;
}

/**
 * The RevenueCat-backed slice. Split out so `usePro` can call both this and
 * `useProMock` unconditionally to satisfy React's rules-of-hooks while
 * still picking the right behavior at render time.
 */
function useRealPro(): UseProResult {
  // We seed `loading` based on the current mode so mock-mode never enters the
  // "still fetching" UI state. Reading `isMockMode()` here is safe — it's a
  // pure function over a module-level flag that flips deterministically once
  // `configureRevenueCat()` runs.
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(() => !isMockMode());
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);

  // Track mount status so async fetches don't write to a torn-down hook.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Configure is idempotent — safe to call from every consumer's effect.
    // The actual SDK init runs at most once per process.
    configureRevenueCat();

    // After configure, we may now be in mock mode. Skip the SDK round-trip
    // entirely so the hook produces no extra state writes (cleaner test
    // output, identical observable behavior — `usePro` ignores this branch
    // in mock mode anyway).
    if (isMockMode()) {
      setLoading(false);
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

  const grant = useCallback(() => {
    console.warn(
      "usePro.grant() is a no-op when RevenueCat is configured. " +
        "The user's Pro state is owned by the App Store / Play Store.",
    );
  }, []);

  const revoke = useCallback(() => {
    console.warn(
      "usePro.revoke() is a no-op when RevenueCat is configured. " +
        "The user's Pro state is owned by the App Store / Play Store.",
    );
  }, []);

  return { isPro, loading, offerings, purchase, restore, grant, revoke };
}
