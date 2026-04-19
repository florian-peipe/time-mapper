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
  /** Seconds offset from `nowSeconds`. Typically negative (earlier). */
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
  it("renders the 'This week' heading and the week date range", () => {
    // Wed 2026-04-15 12:00 local → week Mon Apr 13 → Sun Apr 19
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText(/Apr 13 — Apr 19/)).toBeTruthy();
  });

  it("renders the WeekBarChart and Ledger", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.getByTestId("week-bar-chart")).toBeTruthy();
    expect(screen.getByTestId("ledger")).toBeTruthy();
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

  it("tapping 'Add row' opens entryEdit with a null entryId", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    fireEvent.press(screen.getByTestId("ledger-add-row"));
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toEqual({ entryId: null });
  });

  it("renders Ledger rows for the current week's entries", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    // Two entries earlier the same week — both should show up.
    setup({
      nowMs,
      places: [
        { name: "Home", color: "#FF6A3D", icon: "home" },
        { name: "Office", color: "#1D7FD1", icon: "briefcase" },
      ],
      entries: [
        // Monday morning Home
        { placeIndex: 0, startedAtOffset: -2 * 86_400, endedAtOffset: -2 * 86_400 + 3600 },
        // Wed morning Office
        { placeIndex: 1, startedAtOffset: -3 * 3600, endedAtOffset: -2 * 3600 },
      ],
    });
    expect(screen.getByTestId("ledger-row-0")).toBeTruthy();
    expect(screen.getByTestId("ledger-row-1")).toBeTruthy();
  });

  it("week navigator shows a prev + next chevron and the range label", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.getByTestId("stats-week-nav")).toBeTruthy();
    expect(screen.getByTestId("stats-week-prev")).toBeTruthy();
    expect(screen.getByTestId("stats-week-next")).toBeTruthy();
    expect(screen.getByTestId("stats-week-range").props.children).toMatch(/Apr 13/);
  });

  it("next-week chevron is disabled on the current week (offset 0)", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    const btn = screen.getByTestId("stats-week-next");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("tapping prev-week while NOT Pro opens the paywall (source=history)", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    fireEvent.press(screen.getByTestId("stats-week-prev"));
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toEqual({ source: "history" });
  });

  it("tapping prev-week while Pro navigates the range and enables the next chevron", () => {
    grantProMock();
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    setup({ nowMs });
    fireEvent.press(screen.getByTestId("stats-week-prev"));
    // Offset is now -1 → range shows the prior Monday–Sunday.
    expect(screen.getByTestId("stats-week-range").props.children).toMatch(/Apr 6/);
    // Next is now enabled (can move back toward today).
    const next = screen.getByTestId("stats-week-next");
    expect(next.props.accessibilityState?.disabled).toBe(false);
  });
});
