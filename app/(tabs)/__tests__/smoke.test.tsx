import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore } from "@/state/uiStore";
import { resetProMock } from "@/features/billing/useProMock";
import TimelineRoute from "../index";
import StatsRoute from "../stats";
import SettingsRoute from "../settings";

function wrap(ui: React.ReactNode) {
  const db = createTestDb();
  const places = new PlacesRepo(db, { now: () => 1_700_000_000 });
  const entries = new EntriesRepo(db, { now: () => 1_700_000_000 });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">
        <PlacesRepoProvider value={places}>
          <EntriesRepoProvider value={entries}>{ui}</EntriesRepoProvider>
        </PlacesRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  useUiStore.setState({
    themeOverride: null,
    localeOverride: null,
    onboardingComplete: false,
  });
  resetProMock();
});

describe("tab smoke", () => {
  it("Timeline renders without throwing", () => {
    expect(() => wrap(<TimelineRoute />)).not.toThrow();
  });
  it("Stats renders without throwing", () => {
    expect(() => wrap(<StatsRoute />)).not.toThrow();
  });
  it("Settings renders without throwing", () => {
    expect(() => wrap(<SettingsRoute />)).not.toThrow();
  });
});
