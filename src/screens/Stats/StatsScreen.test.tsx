import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { grantProMock, resetProMock } from "@/features/billing/useProMock";
import { StatsScreen } from "./StatsScreen";

type SeedEntry = {
  placeIndex?: number;
  startedAtOffset: number;
  endedAtOffset: number;
  pauseS?: number;
  note?: string;
};

function setup(opts: {
  nowMs: number;
  places?: { name: string; color?: string; icon?: string }[];
  entries?: SeedEntry[];
}) {
  const nowSeconds = Math.floor(opts.nowMs / 1000);
  jest.useFakeTimers().setSystemTime(new Date(opts.nowMs));

  const db = createTestDb();
  const placesRepo = new PlacesRepo(db, { now: () => nowSeconds });
  const entriesRepo = new EntriesRepo(db, { now: () => nowSeconds });

  const places = (opts.places ?? [{ name: "Home", color: "#FF6A3D", icon: "home" }]).map((p) =>
    placesRepo.create({
      name: p.name,
      address: "",
      latitude: 0,
      longitude: 0,
      color: p.color,
      icon: p.icon,
    }),
  );

  for (const e of opts.entries ?? []) {
    const placeIdx = e.placeIndex ?? 0;
    const place = places[placeIdx];
    if (!place) throw new Error("seed placeIndex out of range");
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: nowSeconds + e.startedAtOffset,
      endedAt: nowSeconds + e.endedAtOffset,
      pauseS: e.pauseS,
      note: e.note,
    });
  }

  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">
        <PlacesRepoProvider value={placesRepo}>
          <EntriesRepoProvider value={entriesRepo}>
            <StatsScreen />
          </EntriesRepoProvider>
        </PlacesRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  return { ...utils, places };
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  resetProMock();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("StatsScreen", () => {
  it("opens in Week mode with the DayNavHeader label", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.getByTestId("stats-nav")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
  });

  it("renders the week bar chart in week mode", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.getByTestId("week-bar-chart")).toBeTruthy();
  });

  it("cycling to Day mode hides the week bar chart", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    // Initial mode = week; tap mode label to cycle → month → year → day.
    fireEvent.press(screen.getByTestId("stats-nav-mode"));
    fireEvent.press(screen.getByTestId("stats-nav-mode"));
    fireEvent.press(screen.getByTestId("stats-nav-mode"));
    // Now on day mode — chart is hidden.
    expect(screen.queryByTestId("week-bar-chart")).toBeNull();
  });

  it("renders the Pro upsell card when the user is not Pro", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.getByTestId("stats-pro-upsell")).toBeTruthy();
    expect(screen.getByText("Past weeks with Pro")).toBeTruthy();
  });

  it("hides the Pro upsell card when the user is Pro", () => {
    grantProMock();
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.queryByTestId("stats-pro-upsell")).toBeNull();
  });

  it("tapping the Pro upsell opens the paywall sheet", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    fireEvent.press(screen.getByTestId("stats-pro-upsell"));
    expect(useSheetStore.getState().active).toBe("paywall");
  });

  it("tapping the Add entry button opens entryEdit with a null entryId", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    fireEvent.press(screen.getByTestId("stats-add-entry"));
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toEqual({ entryId: null });
  });

  it("shows a per-place bar for each place with entries in the range", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const { places } = setup({
      nowMs,
      places: [
        { name: "Home", color: "#FF6A3D", icon: "home" },
        { name: "Office", color: "#1D7FD1", icon: "briefcase" },
      ],
      entries: [
        { placeIndex: 0, startedAtOffset: -2 * 86_400, endedAtOffset: -2 * 86_400 + 3600 },
        { placeIndex: 1, startedAtOffset: -3 * 3600, endedAtOffset: -2 * 3600 },
      ],
    });
    expect(screen.getByTestId(`stats-place-bar-${places[0]!.id}`)).toBeTruthy();
    expect(screen.getByTestId(`stats-place-bar-${places[1]!.id}`)).toBeTruthy();
  });

  it("renders an EntryRow for each entry in the range", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({
      nowMs,
      places: [{ name: "Home", color: "#FF6A3D", icon: "home" }],
      entries: [
        { startedAtOffset: -2 * 86_400, endedAtOffset: -2 * 86_400 + 3600 },
        { startedAtOffset: -3 * 3600, endedAtOffset: -2 * 3600 },
      ],
    });
    // EntryRow uses `stats-entry-row-<id>` testIDs in Stats mode.
    expect(screen.getAllByTestId(/^stats-entry-row-/).length).toBe(2);
  });

  it("tapping prev while on week mode and NOT Pro opens the paywall", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    // Week mode offset 0; one step back is 7 days → 7 > FREE_HISTORY_DAYS/7
    // … actually the gate is at 14 cumulative days. Three weeks back (-3)
    // is 21 days, which IS past the gate. One week back is within it.
    // Tap prev three times to cross the gate.
    fireEvent.press(screen.getByTestId("stats-nav-prev"));
    fireEvent.press(screen.getByTestId("stats-nav-prev"));
    fireEvent.press(screen.getByTestId("stats-nav-prev"));
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toEqual({ source: "history" });
  });
});
