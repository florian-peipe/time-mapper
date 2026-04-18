import { create } from "zustand";

export type ThemeOverride = "light" | "dark" | null;

type UiState = {
  themeOverride: ThemeOverride;
  localeOverride: string | null;
  onboardingComplete: boolean;
  setThemeOverride: (v: ThemeOverride) => void;
  setLocaleOverride: (v: string | null) => void;
  completeOnboarding: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  themeOverride: null,
  localeOverride: null,
  onboardingComplete: false,
  setThemeOverride: (v) => set({ themeOverride: v }),
  setLocaleOverride: (v) => set({ localeOverride: v }),
  completeOnboarding: () => set({ onboardingComplete: true }),
}));
