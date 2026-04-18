import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore } from "@/state/uiStore";
import { grantProMock, resetProMock } from "@/features/billing/useProMock";
import { SettingsScreen } from "./SettingsScreen";

const wrap = (ui: React.ReactNode) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 320, height: 640 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}
  >
    <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>
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

  it("renders all four primary sections", () => {
    render(wrap(<SettingsScreen />));
    expect(screen.getByTestId("settings-section-tracking")).toBeTruthy();
    expect(screen.getByTestId("settings-section-appearance")).toBeTruthy();
    expect(screen.getByTestId("settings-section-data")).toBeTruthy();
    expect(screen.getByTestId("settings-section-about")).toBeTruthy();
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
