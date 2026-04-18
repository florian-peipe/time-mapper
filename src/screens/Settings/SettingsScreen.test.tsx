import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { PlacesRepo } from "@/db/repository/places";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore } from "@/state/uiStore";
import { grantProMock, resetProMock } from "@/features/billing/useProMock";
import { SettingsScreen } from "./SettingsScreen";

function makeRepo(
  seeded: { name: string; address?: string; color?: string; icon?: string }[] = [],
) {
  const db = createTestDb();
  const repo = new PlacesRepo(db);
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
  return repo;
}

const wrap = (ui: React.ReactNode, repo: PlacesRepo = makeRepo()) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 320, height: 640 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}
  >
    <ThemeProvider schemeOverride="light">
      <PlacesRepoProvider value={repo}>{ui}</PlacesRepoProvider>
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

  it("renders all five primary sections (Places first)", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-section-places")).toBeTruthy();
    expect(screen.getByTestId("settings-section-tracking")).toBeTruthy();
    expect(screen.getByTestId("settings-section-appearance")).toBeTruthy();
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
    const repo = makeRepo([
      { name: "Home", address: "1 Example Ln", color: "#FF6A3D", icon: "home" },
      { name: "Gym", address: "42 Fitness Rd", color: "#2E9A5E", icon: "dumbbell" },
    ]);
    render(wrap(<SettingsScreen />, repo));
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("1 Example Ln")).toBeTruthy();
    expect(screen.getByText("Gym")).toBeTruthy();
    expect(screen.getByText("42 Fitness Rd")).toBeTruthy();
    // Add row is present at the bottom; the zero-places row is NOT.
    expect(screen.getByTestId("settings-row-add-place")).toBeTruthy();
    expect(screen.queryByTestId("settings-row-add-first-place")).toBeNull();
  });

  it("tapping a place row opens the AddPlaceSheet in edit mode for that placeId", () => {
    const repo = makeRepo([{ name: "Home" }]);
    const placeId = repo.list()[0]!.id;
    render(wrap(<SettingsScreen />, repo));
    fireEvent.press(screen.getByTestId(`settings-row-place-${placeId}`));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({
      placeId,
      source: "settings-places",
    });
  });

  it("tapping the Add place row at the bottom opens AddPlaceSheet in new mode", () => {
    const repo = makeRepo([{ name: "Home" }]);
    render(wrap(<SettingsScreen />, repo));
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
    expect(screen.getByText("System")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBe("light");
    expect(screen.getByText("Light")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBe("dark");
    expect(screen.getByText("Dark")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBeNull();
    expect(screen.getByText("System")).toBeTruthy();
  });

  it("Language row reflects the active i18n locale (English by default)", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByText("English")).toBeTruthy();
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

  it("tapping the Privacy row calls Linking.openURL with the privacy URL", () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as unknown as never);
    render(wrap(<SettingsScreen />));
    fireEvent.press(screen.getByTestId("settings-row-privacy"));
    expect(spy).toHaveBeenCalledWith("https://timemapper.app/privacy");
    spy.mockRestore();
  });

  it("renders the Developer section under __DEV__ with only the Pro toggle", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-section-dev")).toBeTruthy();
    expect(screen.getByText("Toggle Pro (mock)")).toBeTruthy();
    // v0.3: auto-seed is gone, so the Re-seed and Clear rows were removed.
    expect(screen.queryByText("Re-seed demo data")).toBeNull();
    expect(screen.queryByText("Clear all data")).toBeNull();
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
