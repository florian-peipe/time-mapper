import { useEffect, useRef } from "react";
import { create } from "zustand";
import { KvRepo } from "@/db/repository/kv";
import { createDeviceRepo } from "@/db/deviceDb";
import { KV_KEYS } from "@/db/kvKeys";

export type ThemeOverride = "light" | "dark" | null;

type UiState = {
  themeOverride: ThemeOverride;
  localeOverride: string | null;
  onboardingComplete: boolean;
  setThemeOverride: (v: ThemeOverride) => void;
  setLocaleOverride: (v: string | null) => void;
  completeOnboarding: () => void;
};

/**
 * KV keys the persistence layer writes through to. Kept as exported
 * constants so tests + the KvRepo inspector can reference them directly.
 */
export const UI_STORE_THEME_KV_KEY = KV_KEYS.UI_THEME_OVERRIDE;
export const UI_STORE_LOCALE_KV_KEY = KV_KEYS.UI_LOCALE_OVERRIDE;

/**
 * Resolve a KvRepo for persistence. The repo is loaded lazily from the
 * device DB client — Jest can inject an alternative via `setKvRepoForTests`
 * to avoid pulling in the expo-sqlite native binding.
 */
let injectedKvRepo: KvRepo | null = null;
const getDeviceKvRepo = createDeviceRepo((db) => new KvRepo(db));

function getKvRepo(): KvRepo | null {
  if (injectedKvRepo) return injectedKvRepo;
  try {
    return getDeviceKvRepo();
  } catch {
    return null;
  }
}

/** Test hook — swap or reset the KvRepo the store uses for persistence. */
export function setKvRepoForTests(repo: KvRepo | null): void {
  injectedKvRepo = repo;
}

function readThemeOverride(repo: KvRepo): ThemeOverride {
  const raw = repo.get(UI_STORE_THEME_KV_KEY);
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

function readLocaleOverride(repo: KvRepo): string | null {
  const raw = repo.get(UI_STORE_LOCALE_KV_KEY);
  return raw && raw.length > 0 ? raw : null;
}

function writeThemeOverride(repo: KvRepo, v: ThemeOverride): void {
  if (v == null) repo.delete(UI_STORE_THEME_KV_KEY);
  else repo.set(UI_STORE_THEME_KV_KEY, v);
}

function writeLocaleOverride(repo: KvRepo, v: string | null): void {
  if (v == null) repo.delete(UI_STORE_LOCALE_KV_KEY);
  else repo.set(UI_STORE_LOCALE_KV_KEY, v);
}

export const useUiStore = create<UiState>((set) => ({
  themeOverride: null,
  localeOverride: null,
  onboardingComplete: false,
  setThemeOverride: (v) => {
    set({ themeOverride: v });
    const repo = getKvRepo();
    if (repo) {
      try {
        writeThemeOverride(repo, v);
      } catch {
        // Swallow — KV persistence is a best-effort optimization, in-memory
        // state is still correct.
      }
    }
  },
  setLocaleOverride: (v) => {
    set({ localeOverride: v });
    const repo = getKvRepo();
    if (repo) {
      try {
        writeLocaleOverride(repo, v);
      } catch {
        // See setThemeOverride.
      }
    }
  },
  completeOnboarding: () => set({ onboardingComplete: true }),
}));

/**
 * Hydrate `themeOverride` + `localeOverride` from KV on mount. Safe to call
 * from RootLayout — runs exactly once per app session; re-mounts are a no-op
 * via `hydratedRef`. Kept as a hook rather than a module side-effect so
 * Jest can run the store tests without SQLite in the import graph.
 */
export function useHydrateUiStoreFromKv(): void {
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const repo = getKvRepo();
    if (!repo) return;
    try {
      const themeOverride = readThemeOverride(repo);
      const localeOverride = readLocaleOverride(repo);
      useUiStore.setState({ themeOverride, localeOverride });
    } catch {
      // Best-effort hydration — KV absent means defaults stand.
    }
  }, []);
}
