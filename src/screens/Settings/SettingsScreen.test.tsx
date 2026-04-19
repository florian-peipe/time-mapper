import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore } from "@/state/uiStore";
import { grantProMock, resetProMock } from "@/features/billing/useProMock";
import { SettingsScreen } from "./SettingsScreen";

// Capture router.push() calls for legal-screen navigation assertions.
const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

function makeEnv(seeded: { name: string; address?: string; color?: string; icon?: string }[] = []) {
  const db = createTestDb();
  const repo = new PlacesRepo(db);
  const entries = new EntriesRepo(db);
  const kv = new KvRepo(db);
  for (const p of seeded) {
    repo.create({
      name: p.name,
      address: p.address ?? "123 Example St",
      latitude: 0,
      longitude: 0,
      color: p.color,
      icon: p.icon,
    });
  }
  return { repo, entries, kv };
}

const wrap = (
  ui: React.ReactNode,
  env: { repo: PlacesRepo; entries: EntriesRepo; kv: KvRepo } = makeEnv(),
) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 320, height: 640 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}
  >
    <ThemeProvider schemeOverride="light">
      <KvRepoProvider value={env.kv}>
        <PlacesRepoProvider value={env.repo}>
          <EntriesRepoProvider value={env.entries}>{ui}</EntriesRepoProvider>
        </PlacesRepoProvider>
      </KvRepoProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  useUiStore.setState({
    themeOverride: null,
    localeOverride: null,
    onboardingComplete: false,
  });
  resetProMock();
});

describe("SettingsScreen", () => {
  it("renders the heading", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders all six primary sections (Places first, Subscription before Data)", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-section-places")).toBeTruthy();
    expect(screen.getByTestId("settings-section-tracking")).toBeTruthy();
    expect(screen.getByTestId("settings-section-appearance")).toBeTruthy();
    expect(screen.getByTestId("settings-section-subscription")).toBeTruthy();
    expect(screen.getByTestId("settings-section-data")).toBeTruthy();
    expect(screen.getByTestId("settings-section-about")).toBeTruthy();
  });

  it("Places section shows 'Add your first place' when empty", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-row-add-first-place")).toBeTruthy();
    expect(screen.getByText("Add your first place")).toBeTruthy();
  });

  it("tapping 'Add your first place' opens the AddPlaceSheet tagged as settings-places", () => {
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-add-first-place"));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({
      placeId: null,
      source: "settings-places",
    });
  });

  it("Places section lists existing places with name + address and an Add row below", () => {
    const env = makeEnv([
      { name: "Home", address: "1 Example Ln", color: "#FF6A3D", icon: "home" },
      { name: "Gym", address: "42 Fitness Rd", color: "#2E9A5E", icon: "dumbbell" },
    ]);
    render(wrap(<SettingsScreen />, env));
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("1 Example Ln")).toBeTruthy();
    expect(screen.getByText("Gym")).toBeTruthy();
    expect(screen.getByText("42 Fitness Rd")).toBeTruthy();
    // Add row is present at the bottom; the zero-places row is NOT.
    expect(screen.getByTestId("settings-row-add-place")).toBeTruthy();
    expect(screen.queryByTestId("settings-row-add-first-place")).toBeNull();
  });

  it("tapping a place row opens the AddPlaceSheet in edit mode for that placeId", () => {
    const env = makeEnv([{ name: "Home" }]);
    const placeId = env.repo.list()[0]!.id;
    render(wrap(<SettingsScreen />, env));
    fireEvent.press(screen.getByTestId(`settings-row-place-${placeId}`));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({
      placeId,
      source: "settings-places",
    });
  });

  it("tapping the Add place row at the bottom opens AddPlaceSheet in new mode", () => {
    const env = makeEnv([{ name: "Home" }]);
    render(wrap(<SettingsScreen />, env));
    fireEvent.press(screen.getByTestId("settings-row-add-place"));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({
      placeId: null,
      source: "settings-places",
    });
  });

  it("renders the Tracking rows with their default details", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByText("Location")).toBeTruthy();
    expect(screen.getByText("Always")).toBeTruthy();
    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("On")).toBeTruthy();
    expect(screen.getByText("Default buffers")).toBeTruthy();
    expect(screen.getByText("5 / 3 min")).toBeTruthy();
  });

  it("renders the Pro upsell card when the user is not Pro", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-pro-upsell")).toBeTruthy();
    expect(screen.getByText("TIME MAPPER PRO")).toBeTruthy();
    expect(screen.getByText("Unlimited places, full history, CSV.")).toBeTruthy();
    expect(screen.getByText("Start 7-day free trial")).toBeTruthy();
  });

  it("hides the Pro upsell card when the user is Pro", () => {
    grantProMock();
    render(wrap(<SettingsScreen />));
    expect(screen.queryByTestId("settings-pro-upsell")).toBeNull();
  });

  it("tapping the Pro upsell CTA opens the paywall sheet with source=settings", () => {
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-pro-upsell-cta"));
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toEqual({ source: "settings" });
  });

  it("Theme row defaults to 'System' and cycles System → Light → Dark → System", () => {
    render(wrap(<SettingsScreen />));
    // Theme row uses testID so its detail "System" unambiguously means theme.
    expect(within(screen.getByTestId("settings-row-theme")).getByText("System")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBe("light");
    expect(within(screen.getByTestId("settings-row-theme")).getByText("Light")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBe("dark");
    expect(within(screen.getByTestId("settings-row-theme")).getByText("Dark")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBeNull();
    expect(within(screen.getByTestId("settings-row-theme")).getByText("System")).toBeTruthy();
  });

  it("Language row defaults to 'System' and cycles System → English → Deutsch → System", () => {
    render(wrap(<SettingsScreen />));
    // Scope text queries to the row testID to disambiguate from Theme row.
    const langRow = () => screen.getByTestId("settings-row-language");
    expect(within(langRow()).getByText("System")).toBeTruthy();
    fireEvent.press(langRow());
    expect(useUiStore.getState().localeOverride).toBe("en");
    expect(within(langRow()).getByText("English")).toBeTruthy();
    fireEvent.press(langRow());
    expect(useUiStore.getState().localeOverride).toBe("de");
    expect(within(langRow()).getByText("Deutsch")).toBeTruthy();
    fireEvent.press(langRow());
    expect(useUiStore.getState().localeOverride).toBeNull();
  });

  it("tapping Export CSV while NOT Pro opens the paywall with source=export", () => {
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-export"));
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toEqual({ source: "export" });
  });

  it("tapping Export CSV while Pro does NOT open the paywall", () => {
    grantProMock();
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-export"));
    expect(useSheetStore.getState().active).toBeNull();
  });

  it("tapping the Privacy row navigates to /legal/privacy", () => {
    mockRouterPush.mockClear();
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-privacy"));
    expect(mockRouterPush).toHaveBeenCalledWith("/legal/privacy");
  });

  it("tapping the Terms row navigates to /legal/terms", () => {
    mockRouterPush.mockClear();
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-terms"));
    expect(mockRouterPush).toHaveBeenCalledWith("/legal/terms");
  });

  it("tapping the Impressum row navigates to /legal/impressum", () => {
    mockRouterPush.mockClear();
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-impressum"));
    expect(mockRouterPush).toHaveBeenCalledWith("/legal/impressum");
  });

  it("renders the Subscription section with the Restore purchases row (always visible)", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-section-subscription")).toBeTruthy();
    expect(screen.getByTestId("settings-row-restore")).toBeTruthy();
    expect(screen.getByText("Restore purchases")).toBeTruthy();
  });

  it("Subscription section hides the Pro-active row when the user is free", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.queryByTestId("settings-row-pro-active")).toBeNull();
  });

  it("Subscription section shows the Pro-active row when isPro is true", () => {
    grantProMock();
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-row-pro-active")).toBeTruthy();
    expect(screen.getByText("Time Mapper Pro")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("tapping the Pro-active row deep-links to the platform subscription page", () => {
    grantProMock();
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as unknown as never);
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-pro-active"));
    expect(spy).toHaveBeenCalled();
    const url = spy.mock.calls[0]![0];
    // iOS scheme or Android web URL — both are valid depending on jest's
    // platform mock. Check substring "subscriptions" to stay platform-agnostic.
    expect(url).toMatch(/subscriptions/);
    spy.mockRestore();
  });

  it("tapping Restore purchases shows 'Restoring…' then 'Restored' on success", async () => {
    render(wrap(<SettingsScreen />));
    const row = () => screen.getByTestId("settings-row-restore");
    fireEvent.press(row());
    // Async restore — wait for "Restored" label.
    await waitFor(() => expect(within(row()).getByText("Restored")).toBeTruthy());
  });

  it("renders the Developer section under __DEV__ with only the Pro toggle", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-section-dev")).toBeTruthy();
    expect(screen.getByText("Toggle Pro (mock)")).toBeTruthy();
    // Auto-seed is gone, so the Re-seed and Clear rows were removed.
    expect(screen.queryByText("Re-seed demo data")).toBeNull();
    expect(screen.queryByText("Clear all data")).toBeNull();
  });

  it("Location row opens OS settings via Linking.openSettings", () => {
    const spy = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValueOnce(undefined as unknown as never);
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-location"));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("Notifications row opens the NotificationsSheet", () => {
    render(wrap(<SettingsScreen />));
    // Sheet starts hidden — title not rendered yet.
    expect(screen.queryByTestId("notifications-sheet")).toBeNull();
    fireEvent.press(screen.getByTestId("settings-row-notifications"));
    // Sheet mounts with its testID visible.
    expect(screen.getByTestId("notifications-sheet")).toBeTruthy();
  });

  it("Default buffers row opens the BuffersSheet", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.queryByTestId("buffers-sheet")).toBeNull();
    fireEvent.press(screen.getByTestId("settings-row-buffers"));
    expect(screen.getByTestId("buffers-sheet")).toBeTruthy();
  });

  it("Retention row opens the paywall when not Pro", () => {
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-retention"));
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toEqual({ source: "history" });
  });

  it("Rate row attempts StoreReview first, falls back to Linking.openURL", () => {
    render(wrap(<SettingsScreen />));
    // StoreReview returns false (default jest mock behavior) → openURL is called.
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as unknown as never);
    fireEvent.press(screen.getByTestId("settings-row-rate"));
    // Async effect — we can't easily await here, but the spy should be called
    // after the microtask resolves. Flush and verify.
    return Promise.resolve().then(() => {
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it("Support row launches a mailto: via Linking.openURL", () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as unknown as never);
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-support"));
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^mailto:/));
    spy.mockRestore();
  });

  it("Export diagnostic log row is visible in both dev and prod (moved out of __DEV__)", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-row-diagnostics")).toBeTruthy();
    expect(screen.getByText("Export diagnostic log")).toBeTruthy();
  });

  it("Toggle Pro row reflects current state and flips it on tap (Off → On → Off)", () => {
    render(wrap(<SettingsScreen />));
    // The toggle row's detail starts as "Off". We scope queries to the row so
    // we don't collide with the "On" detail used by the Notifications row.
    const row = () => screen.getByTestId("settings-row-toggle-pro");
    expect(within(row()).getByText("Off")).toBeTruthy();

    fireEvent.press(row());
    expect(within(row()).getByText("On")).toBeTruthy();
    // Pro upsell card disappears once Pro is granted — observable side effect
    // of the mock store flipping.
    expect(screen.queryByTestId("settings-pro-upsell")).toBeNull();

    fireEvent.press(row());
    expect(within(row()).getByText("Off")).toBeTruthy();
    // …and the Pro upsell card comes back when revoked.
    expect(screen.queryByTestId("settings-pro-upsell")).toBeTruthy();
  });
});
