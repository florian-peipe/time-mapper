import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type * as DbClientModule from "@/db/client";
import { KvRepo } from "@/db/repository/kv";
import { useUiStore } from "@/state/uiStore";

/**
 * KV key that marks the onboarding flow as complete. Keeping the string in
 * one place makes it trivial to find (dev tools, migrations, tests).
 */
export const ONBOARDING_COMPLETE_KEY = "onboarding.complete";

/**
 * Test hook — lets `renderHook` inject an in-memory `KvRepo`. Device code
 * omits the provider and the hook falls back to a device-bound repo resolved
 * via a lazy `require` (same pattern as `usePlaces` / `useEntries`).
 */
const KvRepoContext = createContext<KvRepo | null>(null);

export function KvRepoProvider({ value, children }: { value: KvRepo; children: React.ReactNode }) {
  return <KvRepoContext.Provider value={value}>{children}</KvRepoContext.Provider>;
}

let cachedDeviceRepo: KvRepo | null = null;
function getDeviceRepo(): KvRepo {
  if (!cachedDeviceRepo) {
    // Deferred require so Jest never touches the expo-sqlite device binding.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as typeof DbClientModule;
    cachedDeviceRepo = new KvRepo(db);
  }
  return cachedDeviceRepo;
}

export function useKvRepo(): KvRepo {
  const injected = useContext(KvRepoContext);
  return useMemo(() => injected ?? getDeviceRepo(), [injected]);
}

export type UseOnboardingGateResult = {
  /** Flips to true once the initial KV read resolves. Gate until then. */
  hydrated: boolean;
  /** True when the KV flag is missing → user should see onboarding. */
  needsOnboarding: boolean;
  /** Writes the KV flag and mirrors into `uiStore.onboardingComplete`. */
  markComplete: () => void;
  /** Clear the flag so the user is routed back through onboarding on next boot. */
  reset: () => void;
};

/**
 * Reads the `onboarding.complete` KV flag on mount and exposes a
 * `markComplete` setter that writes through to both the KV store
 * (survives reinstall-less app restarts) and the Zustand `uiStore`
 * (so any screen subscribed to that slice re-renders immediately).
 *
 * Why both? KV is the durable source of truth, but Zustand is what
 * drives cross-tree re-renders without prop drilling. The dual-write
 * keeps the two in sync.
 */
export function useOnboardingGate(): UseOnboardingGateResult {
  const repo = useKvRepo();
  const onboardingComplete = useUiStore((s) => s.onboardingComplete);
  const completeOnboardingInStore = useUiStore((s) => s.completeOnboarding);

  const [hydrated, setHydrated] = useState(false);
  const [kvFlagPresent, setKvFlagPresent] = useState(false);

  useEffect(() => {
    const v = repo.get(ONBOARDING_COMPLETE_KEY);
    setKvFlagPresent(v === "1");
    setHydrated(true);
  }, [repo]);

  const markComplete = useCallback(() => {
    repo.set(ONBOARDING_COMPLETE_KEY, "1");
    setKvFlagPresent(true);
    completeOnboardingInStore();
  }, [repo, completeOnboardingInStore]);

  const reset = useCallback(() => {
    repo.delete(ONBOARDING_COMPLETE_KEY);
    setKvFlagPresent(false);
    useUiStore.setState({ onboardingComplete: false });
  }, [repo]);

  // `needsOnboarding` is true until EITHER source says we're done.
  // The store slice lets a sibling flow (e.g. skip button) short-circuit
  // without waiting for the next KV read.
  const needsOnboarding = hydrated && !kvFlagPresent && !onboardingComplete;

  return { hydrated, needsOnboarding, markComplete, reset };
}
