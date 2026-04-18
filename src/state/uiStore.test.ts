import { useUiStore } from "./uiStore";

beforeEach(() => {
  useUiStore.setState({ themeOverride: null, localeOverride: null, onboardingComplete: false });
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
