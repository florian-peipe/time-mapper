import { renderHook, act } from "@testing-library/react-native";
import { createTestDb } from "@/db/testClient";
import { KvRepo } from "@/db/repository/kv";
import {
  useUiStore,
  setKvRepoForTests,
  useHydrateUiStoreFromKv,
  UI_STORE_THEME_KV_KEY,
  UI_STORE_LOCALE_KV_KEY,
} from "./uiStore";

function makeDb() {
  return createTestDb();
}

beforeEach(() => {
  useUiStore.setState({
    themeOverride: null,
    localeOverride: null,
    onboardingComplete: false,
    hydrated: false,
  });
  setKvRepoForTests(null);
});

describe("uiStore", () => {
  it("defaults to no overrides and onboarding incomplete", () => {
    const s = useUiStore.getState();
    expect(s.themeOverride).toBeNull();
    expect(s.localeOverride).toBeNull();
    expect(s.onboardingComplete).toBe(false);
  });

  it("can override theme", () => {
    useUiStore.getState().setThemeOverride("dark");
    expect(useUiStore.getState().themeOverride).toBe("dark");
  });

  it("marks onboarding complete", () => {
    useUiStore.getState().completeOnboarding();
    expect(useUiStore.getState().onboardingComplete).toBe(true);
  });
});

describe("uiStore persistence", () => {
  it("persists themeOverride through the KvRepo on set", () => {
    const db = makeDb();
    const repo = new KvRepo(db);
    setKvRepoForTests(repo);

    useUiStore.getState().setThemeOverride("dark");
    expect(repo.get(UI_STORE_THEME_KV_KEY)).toBe("dark");

    useUiStore.getState().setThemeOverride(null);
    expect(repo.get(UI_STORE_THEME_KV_KEY)).toBeNull();
  });

  it("persists localeOverride through the KvRepo on set", () => {
    const db = makeDb();
    const repo = new KvRepo(db);
    setKvRepoForTests(repo);

    useUiStore.getState().setLocaleOverride("de");
    expect(repo.get(UI_STORE_LOCALE_KV_KEY)).toBe("de");

    useUiStore.getState().setLocaleOverride(null);
    expect(repo.get(UI_STORE_LOCALE_KV_KEY)).toBeNull();
  });

  it("hydrates both override values from KV on mount", () => {
    const db = makeDb();
    const repo = new KvRepo(db);
    repo.set(UI_STORE_THEME_KV_KEY, "dark");
    repo.set(UI_STORE_LOCALE_KV_KEY, "de");
    setKvRepoForTests(repo);

    const { result } = renderHook(() => {
      useHydrateUiStoreFromKv();
      return useUiStore();
    });

    expect(result.current.themeOverride).toBe("dark");
    expect(result.current.localeOverride).toBe("de");
    expect(result.current.hydrated).toBe(true);
  });

  it("survives a simulated remount — persisted value rehydrates", () => {
    const db = makeDb();
    const repo = new KvRepo(db);
    setKvRepoForTests(repo);

    // First mount — user picks dark.
    const first = renderHook(() => {
      useHydrateUiStoreFromKv();
      return useUiStore();
    });
    act(() => {
      first.result.current.setThemeOverride("dark");
    });
    expect(first.result.current.themeOverride).toBe("dark");
    first.unmount();

    // Reset the in-memory store back to defaults (simulates a cold start).
    useUiStore.setState({
      themeOverride: null,
      localeOverride: null,
      onboardingComplete: false,
      hydrated: false,
    });

    // Second mount — the persisted value should be restored from KV.
    const second = renderHook(() => {
      useHydrateUiStoreFromKv();
      return useUiStore();
    });
    expect(second.result.current.themeOverride).toBe("dark");
  });

  it("ignores malformed KV values and falls back to default", () => {
    const db = makeDb();
    const repo = new KvRepo(db);
    repo.set(UI_STORE_THEME_KV_KEY, "neon"); // not a valid override
    setKvRepoForTests(repo);

    const { result } = renderHook(() => {
      useHydrateUiStoreFromKv();
      return useUiStore();
    });
    expect(result.current.themeOverride).toBeNull();
  });
});
