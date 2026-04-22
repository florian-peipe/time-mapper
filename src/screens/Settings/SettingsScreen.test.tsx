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
import { __setProForTests } from "@/features/billing/usePro";
import * as openPaywallModule from "@/features/billing/openPaywall";
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
  __setProForTests(null);
});

describe("SettingsScreen", () => {
  it("renders the heading", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders the five primary sections (places moved to the dedicated Places tab)", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-section-tracking")).toBeTruthy();
    expect(screen.getByTestId("settings-section-appearance")).toBeTruthy();
    expect(screen.getByTestId("settings-section-subscription")).toBeTruthy();
    expect(screen.getByTestId("settings-section-data")).toBeTruthy();
    expect(screen.getByTestId("settings-section-about")).toBeTruthy();
    // Places section was extracted into its own tab — must no longer appear here.
    expect(screen.queryByTestId("settings-section-places")).toBeNull();
  });

  it("renders the Tracking rows", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-row-location")).toBeTruthy();
    expect(screen.getByTestId("settings-row-notifications")).toBeTruthy();
    expect(screen.getByTestId("settings-row-buffers")).toBeTruthy();
    // Buffer row detail reads from the live KV defaults (2min entry, 1min
    // exit) rather than a hardcoded string — asserting the formatted value.
    expect(screen.getByText("2 / 1 min")).toBeTruthy();
  });

  it("renders the Pro upsell card when the user is not Pro", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-pro-upsell")).toBeTruthy();
    expect(screen.getByText("TIME MAPPER PRO")).toBeTruthy();
    expect(screen.getByText("Unlimited places, full history, CSV.")).toBeTruthy();
    expect(screen.getByText("Start 7-day free trial")).toBeTruthy();
  });

  it("hides the Pro upsell card when the user is Pro", () => {
    __setProForTests(true);
    render(wrap(<SettingsScreen />));
    expect(screen.queryByTestId("settings-pro-upsell")).toBeNull();
  });

  it("tapping the Pro upsell CTA calls openPaywall with source=settings", () => {
    const spy = jest.spyOn(openPaywallModule, "openPaywall").mockImplementation(() => undefined);
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-pro-upsell-cta"));
    expect(spy).toHaveBeenCalledWith({ source: "settings" });
    spy.mockRestore();
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

  it("tapping Export CSV while NOT Pro calls openPaywall with source=export", () => {
    const spy = jest.spyOn(openPaywallModule, "openPaywall").mockImplementation(() => undefined);
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-export"));
    expect(spy).toHaveBeenCalledWith({ source: "export" });
    spy.mockRestore();
  });

  it("tapping Export CSV while Pro does NOT open the paywall", () => {
    const spy = jest.spyOn(openPaywallModule, "openPaywall").mockImplementation(() => undefined);
    __setProForTests(true);
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-export"));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
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
    __setProForTests(true);
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-row-pro-active")).toBeTruthy();
    expect(screen.getByText("Time Mapper Pro")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("tapping the Pro-active row opens the RevenueCat Customer Center", async () => {
    __setProForTests(true);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RevenueCatUI = require("react-native-purchases-ui").default as {
      presentCustomerCenter: jest.Mock;
    };
    RevenueCatUI.presentCustomerCenter.mockClear();
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-pro-active"));
    await Promise.resolve();
    expect(RevenueCatUI.presentCustomerCenter).toHaveBeenCalled();
  });

  it("tapping Restore purchases shows 'Restoring…' then 'Restored' on success", async () => {
    render(wrap(<SettingsScreen />));
    const row = () => screen.getByTestId("settings-row-restore");
    fireEvent.press(row());
    // Async restore — wait for "Restored" label.
    await waitFor(() => expect(within(row()).getByText("Restored")).toBeTruthy());
  });

  it("no Developer section is rendered", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.queryByTestId("settings-section-dev")).toBeNull();
    expect(screen.queryByText("Toggle Pro (mock)")).toBeNull();
    expect(screen.queryByText("Simulate visit")).toBeNull();
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

  it("History row defaults to 'Forever' and cycles Forever → 6 months → 1 year → 2 years", () => {
    render(wrap(<SettingsScreen />));
    const historyRow = () => screen.getByTestId("settings-row-history");
    expect(within(historyRow()).getByText("Forever")).toBeTruthy();
    fireEvent.press(historyRow());
    expect(within(historyRow()).getByText(/6 months/)).toBeTruthy();
    fireEvent.press(historyRow());
    expect(within(historyRow()).getByText(/1 years/)).toBeTruthy();
    fireEvent.press(historyRow());
    expect(within(historyRow()).getByText(/2 years/)).toBeTruthy();
    fireEvent.press(historyRow());
    // Back to Forever.
    expect(within(historyRow()).getByText("Forever")).toBeTruthy();
  });

  it("History row persists the cap to KV", () => {
    const env = makeEnv();
    render(wrap(<SettingsScreen />, env));
    fireEvent.press(screen.getByTestId("settings-row-history"));
    expect(env.kv.get("retention.hard_cap_days")).toBe("180");
    fireEvent.press(screen.getByTestId("settings-row-history"));
    expect(env.kv.get("retention.hard_cap_days")).toBe("365");
  });

  it("Storage row renders the place + entry count from the repos", () => {
    const env = makeEnv([{ name: "Home" }, { name: "Office" }]);
    // Seed two entries.
    const placeIds = env.repo.list().map((p) => p.id);
    env.entries.createManual({
      placeId: placeIds[0]!,
      startedAt: 1000,
      endedAt: 2000,
    });
    env.entries.createManual({
      placeId: placeIds[1]!,
      startedAt: 3000,
      endedAt: 4000,
    });
    render(wrap(<SettingsScreen />, env));
    const sizeRow = screen.getByTestId("settings-row-size");
    expect(within(sizeRow).getByText(/2 places · 2 entries/)).toBeTruthy();
  });
});
