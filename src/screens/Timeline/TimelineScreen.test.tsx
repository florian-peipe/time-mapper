import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import type { Entry } from "@/db/schema";
import { TimelineScreen } from "./TimelineScreen";

type SeedEntry = {
  /** Seconds offset from the given `nowSeconds` of the test setup. */
  startedAtOffset: number;
  /** Seconds offset from the given `nowSeconds`. `null` for an ongoing entry. */
  endedAtOffset: number | null;
  note?: string;
  pauseS?: number;
  source?: "auto" | "manual";
};

type SeedPlace = {
  name: string;
  color?: string;
  icon?: string;
};

/**
 * Wrap the screen under a matching set of providers with deterministic time.
 * `nowMs` is the `Date.now()` value the hooks will observe.
 */
function setup(opts: {
  nowMs: number;
  places?: SeedPlace[];
  entries?: (Omit<SeedEntry, "source"> & { placeIndex?: number })[];
  ongoing?: SeedEntry & { placeIndex?: number };
}) {
  const nowMs = opts.nowMs;
  const nowSeconds = Math.floor(nowMs / 1000);
  jest.useFakeTimers().setSystemTime(new Date(nowMs));

  const db = createTestDb();
  const placesRepo = new PlacesRepo(db, { now: () => nowSeconds });
  const entriesRepo = new EntriesRepo(db, { now: () => nowSeconds });
  const kvRepo = new KvRepo(db);

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

  // Only "manual" entries are directly seedable through the repo API. An
  // ongoing entry is handled separately below via `entriesRepo.open()`.
  const seeded: Entry[] = [];
  for (const e of opts.entries ?? []) {
    const placeIdx = e.placeIndex ?? 0;
    const place = places[placeIdx];
    if (!place) throw new Error(`seed placeIndex ${placeIdx} out of range`);
    const startedAt = nowSeconds + e.startedAtOffset;
    const endedAt = e.endedAtOffset != null ? nowSeconds + e.endedAtOffset : nowSeconds;
    const manual = entriesRepo.createManual({
      placeId: place.id,
      startedAt,
      endedAt,
      note: e.note,
      pauseS: e.pauseS,
    });
    seeded.push(manual);
  }

  if (opts.ongoing) {
    const placeIdx = opts.ongoing.placeIndex ?? 0;
    const place = places[placeIdx];
    if (!place) throw new Error("ongoing seed placeIndex out of range");
    entriesRepo.open({
      placeId: place.id,
      source: opts.ongoing.source ?? "auto",
      startedAt: nowSeconds + opts.ongoing.startedAtOffset,
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
        <KvRepoProvider value={kvRepo}>
          <PlacesRepoProvider value={placesRepo}>
            <EntriesRepoProvider value={entriesRepo}>
              <TimelineScreen />
            </EntriesRepoProvider>
          </PlacesRepoProvider>
        </KvRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  return { ...utils, placesRepo, entriesRepo, places, seeded };
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("TimelineScreen", () => {
  it("renders the zero-places hero empty state (place-first primary CTA)", () => {
    // Noon local April 17, 2026 — deterministic.
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    // Explicit empty places array to bypass the default Home seed and
    // trigger the zero-places hero.
    setup({ nowMs, places: [] });
    // New copy: "Add a place to start tracking" is the primary hero.
    expect(screen.getByText("Add a place to start tracking")).toBeTruthy();
    expect(screen.getByTestId("timeline-add-place-cta")).toBeTruthy();
    // And the manual-entry FAB is hidden — manual is the escape hatch, not
    // the hero, when no place exists to auto-track against.
    expect(screen.queryByTestId("timeline-fab")).toBeNull();
  });

  it("zero-places CTA opens the AddPlaceSheet with placeId=null", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    setup({ nowMs, places: [] });
    fireEvent.press(screen.getByTestId("timeline-add-place-cta"));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({ placeId: null });
  });

  it("renders the 'You're set up.' empty state when places exist but no entries today", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    setup({ nowMs });
    // Second-state copy.
    expect(screen.getByText("You're set up.")).toBeTruthy();
    expect(screen.getByText("Visits to your places will appear here automatically.")).toBeTruthy();
    expect(screen.getByTestId("timeline-add-another-place")).toBeTruthy();
    // Small manual-entry FAB IS present once a place exists.
    expect(screen.getByTestId("timeline-fab")).toBeTruthy();
  });

  it("'Add another place' tertiary button opens AddPlaceSheet", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    setup({ nowMs });
    fireEvent.press(screen.getByTestId("timeline-add-another-place"));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({ placeId: null });
  });

  it("renders a row per entry with place name and tabular duration", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const nowSeconds = Math.floor(nowMs / 1000);
    setup({
      nowMs,
      places: [
        { name: "Home", color: "#FF6A3D", icon: "home" },
        { name: "Office", color: "#1D7FD1", icon: "briefcase" },
      ],
      entries: [
        // 09:00 → 10:00 manual at Home, -3h..-2h from now (12:00)
        {
          placeIndex: 0,
          startedAtOffset: -3 * 3600,
          endedAtOffset: -2 * 3600,
        },
        // 10:30 → 11:15 manual at Office with 5m pause -> 40m net
        {
          placeIndex: 1,
          startedAtOffset: -90 * 60,
          endedAtOffset: -45 * 60,
          pauseS: 5 * 60,
        },
      ],
    });

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Office")).toBeTruthy();
    // Duration labels: "1h 00m" for Home, "0h 40m" for Office.
    expect(screen.getByText("1h 00m")).toBeTruthy();
    expect(screen.getByText("0h 40m")).toBeTruthy();
    // Total in header: 1h 40m tracked
    expect(screen.getByText(/1h 40m tracked/)).toBeTruthy();
    // Use the local clock string. Note: nowSeconds ignored here beyond helping us understand.
    expect(nowSeconds).toBeGreaterThan(0);
  });

  it("does not render RunningTimerCard when no ongoing entry exists", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    setup({ nowMs });
    expect(screen.queryByTestId("running-timer-card")).toBeNull();
  });

  it("renders the RunningTimerCard on dayOffset 0 when an ongoing entry exists", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    setup({
      nowMs,
      ongoing: { startedAtOffset: -45 * 60, endedAtOffset: null },
    });
    expect(screen.getByTestId("running-timer-card")).toBeTruthy();
    expect(screen.getByText(/Tracking/)).toBeTruthy();
    // Elapsed timer — 45:00 at the mocked now.
    expect(screen.getByTestId("running-timer-card-elapsed").props.children).toBe("00:45:00");
  });

  it("hides the RunningTimerCard when navigating to yesterday", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    setup({
      nowMs,
      ongoing: { startedAtOffset: -45 * 60, endedAtOffset: null },
    });
    expect(screen.getByTestId("running-timer-card")).toBeTruthy();
    // Tap previous-day chevron.
    const prev = screen.getByLabelText("Previous");
    fireEvent.press(prev);
    expect(screen.queryByTestId("running-timer-card")).toBeNull();
  });

  it("FAB press opens the entryEdit sheet with entryId: null", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    // FAB only renders once at least one place exists (place-first pivot) —
    // the default `setup` seeds Home, so the FAB is present.
    setup({ nowMs });
    fireEvent.press(screen.getByTestId("timeline-fab"));
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toMatchObject({ entryId: null });
  });

  it("tapping an EntryRow opens the entryEdit sheet with that entry's id", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { seeded } = setup({
      nowMs,
      entries: [
        {
          placeIndex: 0,
          startedAtOffset: -3 * 3600,
          endedAtOffset: -2 * 3600,
        },
      ],
    });
    fireEvent.press(screen.getByText("Home"));
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toEqual({ entryId: seeded[0]?.id });
  });

  it("right chevron is disabled on today (dayOffset === 0)", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    setup({ nowMs });
    const next = screen.getByLabelText("Next");
    expect(next.props.accessibilityState?.disabled).toBe(true);
  });

  it("totalMin header updates when switching between days", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const nowSeconds = Math.floor(nowMs / 1000);
    // Add an entry yesterday: 2h long. Seeding a place is implicit via the
    // `places` default in `setup`, so the "You're set up." state renders today.
    setup({
      nowMs,
      entries: [
        {
          placeIndex: 0,
          startedAtOffset: -24 * 3600,
          endedAtOffset: -22 * 3600,
        },
      ],
    });
    // Sanity: today renders empty (but "You're set up." state now, not zero-places).
    expect(screen.getByText(/0h 0m tracked/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Previous"));
    expect(screen.getByText(/2h 0m tracked/)).toBeTruthy();
    expect(nowSeconds).toBeGreaterThan(0);
  });

  it("re-fetches entries after the entryEdit sheet closes", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    // Default seed (one Home place) gives us the "You're set up." state
    // which is what we want — the zero-places hero has no entry list to
    // refresh into.
    const { entriesRepo, places } = setup({ nowMs });
    expect(screen.getByText("You're set up.")).toBeTruthy();
    // Open then close the sheet, with a new entry having been inserted in between.
    act(() => {
      useSheetStore.getState().openSheet("entryEdit", { entryId: null });
    });
    const nowSeconds = Math.floor(nowMs / 1000);
    const firstPlace = places[0];
    if (!firstPlace) throw new Error("expected seeded place");
    entriesRepo.createManual({
      placeId: firstPlace.id,
      startedAt: nowSeconds - 3600,
      endedAt: nowSeconds - 1800,
    });
    act(() => {
      useSheetStore.getState().closeSheet();
    });
    expect(screen.getByText("Home")).toBeTruthy();
  });
});
