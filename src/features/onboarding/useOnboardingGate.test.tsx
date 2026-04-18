import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import { useUiStore } from "@/state/uiStore";
import { KvRepoProvider, ONBOARDING_COMPLETE_KEY, useOnboardingGate } from "./useOnboardingGate";

function wrap(repo: KvRepo) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <KvRepoProvider value={repo}>{children}</KvRepoProvider>;
  };
}

beforeEach(() => {
  useUiStore.setState({ themeOverride: null, localeOverride: null, onboardingComplete: false });
});

describe("useOnboardingGate", () => {
  it("reports needsOnboarding=true when the KV flag is missing", () => {
    const db = createTestDb();
    const repo = new KvRepo(db);
    const { result } = renderHook(() => useOnboardingGate(), { wrapper: wrap(repo) });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.needsOnboarding).toBe(true);
  });

  it("reports needsOnboarding=false when KV has '1'", () => {
    const db = createTestDb();
    const repo = new KvRepo(db);
    repo.set(ONBOARDING_COMPLETE_KEY, "1");
    const { result } = renderHook(() => useOnboardingGate(), { wrapper: wrap(repo) });
    expect(result.current.needsOnboarding).toBe(false);
  });

  it("markComplete writes the KV flag and flips the store slice", () => {
    const db = createTestDb();
    const repo = new KvRepo(db);
    const { result } = renderHook(() => useOnboardingGate(), { wrapper: wrap(repo) });
    expect(result.current.needsOnboarding).toBe(true);
    act(() => {
      result.current.markComplete();
    });
    expect(result.current.needsOnboarding).toBe(false);
    expect(repo.get(ONBOARDING_COMPLETE_KEY)).toBe("1");
    expect(useUiStore.getState().onboardingComplete).toBe(true);
  });

  it("reflects the store slice flip even without a KV re-read", () => {
    const db = createTestDb();
    const repo = new KvRepo(db);
    const { result } = renderHook(() => useOnboardingGate(), { wrapper: wrap(repo) });
    expect(result.current.needsOnboarding).toBe(true);
    act(() => {
      useUiStore.getState().completeOnboarding();
    });
    expect(result.current.needsOnboarding).toBe(false);
  });
});
