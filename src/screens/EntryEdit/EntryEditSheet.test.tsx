import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { createTestDb } from "@/db/testClient";
import { useSnackbarStore } from "@/state/snackbarStore";
import type { Entry, Place } from "@/db/schema";
import { EntryEditSheet } from "./EntryEditSheet";

type SeedPlace = { name: string; color?: string; icon?: string };

function setup(opts: {
  /** Fake-timers now in ms; drives both the clock and the hooks. */
  nowMs: number;
  places?: SeedPlace[];
  /** Optional seeded entry to render in edit mode. */
  entry?: {
    placeIndex?: number;
    startedAtOffset: number;
    endedAtOffset: number;
    pauseS?: number;
    note?: string;
    source?: "auto" | "manual";
  };
  /** entryId prop passed into the sheet — null means "New" mode. */
  mode: "new" | "edit";
  onClose?: () => void;
}) {
  const { nowMs } = opts;
  const nowSeconds = Math.floor(nowMs / 1000);
  jest.useFakeTimers().setSystemTime(new Date(nowMs));

  const db = createTestDb();
  const placesRepo = new PlacesRepo(db, { now: () => nowSeconds });
  const entriesRepo = new EntriesRepo(db, { now: () => nowSeconds });

  const places: Place[] = (
    opts.places ?? [
      { name: "Home", color: "#FF6A3D", icon: "home" },
      { name: "Office", color: "#1D7FD1", icon: "briefcase" },
    ]
  ).map((p) =>
    placesRepo.create({
      name: p.name,
      address: "",
      latitude: 0,
      longitude: 0,
      color: p.color,
      icon: p.icon,
    }),
  );

  let entry: Entry | null = null;
  if (opts.entry) {
    const placeIdx = opts.entry.placeIndex ?? 0;
    const place = places[placeIdx];
    if (!place) throw new Error(`entry placeIndex ${placeIdx} out of range`);
    if (opts.entry.source === "auto") {
      // For auto entries we use the repo's `open` path and then close it so
      // the source column is stored as "auto" without a direct SQL patch.
      const opened = entriesRepo.open({
        placeId: place.id,
        source: "auto",
        startedAt: nowSeconds + opts.entry.startedAtOffset,
      });
      entry = entriesRepo.update(opened.id, {
        endedAt: nowSeconds + opts.entry.endedAtOffset,
        pauseS: opts.entry.pauseS,
        note: opts.entry.note,
      });
    } else {
      entry = entriesRepo.createManual({
        placeId: place.id,
        startedAt: nowSeconds + opts.entry.startedAtOffset,
        endedAt: nowSeconds + opts.entry.endedAtOffset,
        pauseS: opts.entry.pauseS,
        note: opts.entry.note,
      });
    }
  }

  const onClose = opts.onClose ?? jest.fn();

  const utils = render(
    <ThemeProvider schemeOverride="light">
      <PlacesRepoProvider value={placesRepo}>
        <EntriesRepoProvider value={entriesRepo}>
          <EntryEditSheet
            visible
            entryId={opts.mode === "new" ? null : (entry?.id ?? null)}
            onClose={onClose}
          />
        </EntriesRepoProvider>
      </PlacesRepoProvider>
    </ThemeProvider>,
  );

  return { ...utils, placesRepo, entriesRepo, places, entry, onClose };
}

afterEach(() => {
  jest.useRealTimers();
});

describe("EntryEditSheet — New mode", () => {
  it("renders the 'New entry' title and default fields (09:00 → 10:00, 0m break)", () => {
    setup({ nowMs: new Date(2026, 3, 17, 12, 0, 0).getTime(), mode: "new" });

    expect(screen.getByText("New entry")).toBeTruthy();
    // Net duration readout: 1h 00m net, 1h 00m gross, 0m break
    expect(screen.getByTestId("entry-edit-net")).toBeTruthy();
    expect(screen.getByTestId("entry-edit-net").props.children).toBe("1h 00m");
    expect(screen.getByText(/1h 00m gross/)).toBeTruthy();
    expect(screen.getByText(/0m break/)).toBeTruthy();
    // Time inputs carry the default values.
    expect(screen.getByTestId("entry-edit-start").props.value).toBe("09:00");
    expect(screen.getByTestId("entry-edit-end").props.value).toBe("10:00");
    expect(screen.getByTestId("entry-edit-pause").props.value).toBe("0");
  });

  it("defaults the place to the first place in the list", () => {
    setup({
      nowMs: new Date(2026, 3, 17, 12, 0, 0).getTime(),
      mode: "new",
      places: [
        { name: "Home", color: "#FF6A3D", icon: "home" },
        { name: "Office", color: "#1D7FD1", icon: "briefcase" },
      ],
    });

    // Collapsed row shows the selected place's name — first one.
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.queryByText("Office")).toBeNull();
  });

  it("does not render the Delete button in New mode", () => {
    setup({ nowMs: new Date(2026, 3, 17, 12, 0, 0).getTime(), mode: "new" });
    expect(screen.queryByText("Delete entry")).toBeNull();
  });
});

describe("EntryEditSheet — Edit mode", () => {
  it("renders the 'Edit entry' title and hydrates fields from the entry", () => {
    // Entry from 10:15 → 12:00 with 15m pause, note "client call", on Office.
    const nowMs = new Date(2026, 3, 17, 14, 0, 0).getTime();
    setup({
      nowMs,
      mode: "edit",
      entry: {
        placeIndex: 1,
        // Offsets from nowSeconds (14:00). 10:15 = -3h45m, 12:00 = -2h.
        startedAtOffset: -3 * 3600 - 45 * 60,
        endedAtOffset: -2 * 3600,
        pauseS: 15 * 60,
        note: "client call",
      },
    });

    expect(screen.getByText("Edit entry")).toBeTruthy();
    // Selected place is Office.
    expect(screen.getByText("Office")).toBeTruthy();
    // Time fields hydrated as local HH:MM.
    expect(screen.getByTestId("entry-edit-start").props.value).toBe("10:15");
    expect(screen.getByTestId("entry-edit-end").props.value).toBe("12:00");
    expect(screen.getByTestId("entry-edit-pause").props.value).toBe("15");
    // Note hydrated.
    expect(screen.getByTestId("entry-edit-note").props.value).toBe("client call");
  });

  it("shows Delete entry button in Edit mode", () => {
    const nowMs = new Date(2026, 3, 17, 14, 0, 0).getTime();
    setup({
      nowMs,
      mode: "edit",
      entry: {
        placeIndex: 0,
        startedAtOffset: -2 * 3600,
        endedAtOffset: -3600,
      },
    });
    expect(screen.getByText("Delete entry")).toBeTruthy();
  });

  it("calls softDelete and onClose when Delete is pressed", () => {
    const onClose = jest.fn();
    const nowMs = new Date(2026, 3, 17, 14, 0, 0).getTime();
    const { entry, entriesRepo } = setup({
      nowMs,
      mode: "edit",
      onClose,
      entry: {
        placeIndex: 0,
        startedAtOffset: -2 * 3600,
        endedAtOffset: -3600,
      },
    });
    fireEvent.press(screen.getByText("Delete entry"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(entry).not.toBeNull();
    if (!entry) return;
    const after = entriesRepo.get(entry.id);
    expect(after?.deletedAt).not.toBeNull();
  });

  it("shows an undo snackbar after delete and restores the entry when Undo fires", () => {
    useSnackbarStore.setState({ current: null, seq: 0 });
    const nowMs = new Date(2026, 3, 17, 14, 0, 0).getTime();
    const { entry, entriesRepo } = setup({
      nowMs,
      mode: "edit",
      entry: {
        placeIndex: 0,
        startedAtOffset: -2 * 3600,
        endedAtOffset: -3600,
      },
    });
    fireEvent.press(screen.getByText("Delete entry"));
    const snack = useSnackbarStore.getState().current;
    expect(snack).not.toBeNull();
    expect(snack?.message).toBe("Entry deleted");
    expect(snack?.action?.label).toBe("Undo");
    expect(snack?.ttlMs).toBe(5000);

    if (!entry) return;
    // Before undo — deletedAt is set.
    expect(entriesRepo.get(entry.id)?.deletedAt).not.toBeNull();
    // Fire undo.
    snack?.action?.onPress();
    // Row is restored.
    expect(entriesRepo.get(entry.id)?.deletedAt).toBeNull();
  });
});

describe("EntryEditSheet — Net-duration math", () => {
  it("recomputes net = gross − pause when pause changes", () => {
    setup({ nowMs: new Date(2026, 3, 17, 12, 0, 0).getTime(), mode: "new" });
    // Default is 1h gross, 0m pause → 1h 00m net.
    expect(screen.getByTestId("entry-edit-net").props.children).toBe("1h 00m");
    // Type 15 into the pause field.
    fireEvent.changeText(screen.getByTestId("entry-edit-pause"), "15");
    expect(screen.getByTestId("entry-edit-net").props.children).toBe("0h 45m");
  });

  it("clamps net to zero when pause exceeds gross", () => {
    setup({ nowMs: new Date(2026, 3, 17, 12, 0, 0).getTime(), mode: "new" });
    fireEvent.changeText(screen.getByTestId("entry-edit-pause"), "999");
    expect(screen.getByTestId("entry-edit-net").props.children).toBe("0h 00m");
  });
});

describe("EntryEditSheet — validation", () => {
  it("shows an inline error and does NOT save when the Start value is invalid", () => {
    const onClose = jest.fn();
    const { entriesRepo } = setup({
      nowMs: new Date(2026, 3, 17, 12, 0, 0).getTime(),
      mode: "new",
      onClose,
    });
    // Break the start field.
    fireEvent.changeText(screen.getByTestId("entry-edit-start"), "abc");
    // Attempt save.
    fireEvent.press(screen.getByTestId("entry-edit-save"));
    expect(onClose).not.toHaveBeenCalled();
    expect(entriesRepo.listBetween(0, 2_000_000_000)).toEqual([]);
    // Inline error text is visible.
    expect(screen.getByText(/HH:MM/)).toBeTruthy();
  });
});

describe("EntryEditSheet — place picker", () => {
  it("lets the user switch place via the expanded chip list", () => {
    setup({
      nowMs: new Date(2026, 3, 17, 12, 0, 0).getTime(),
      mode: "new",
      places: [
        { name: "Home", color: "#FF6A3D", icon: "home" },
        { name: "Office", color: "#1D7FD1", icon: "briefcase" },
      ],
    });

    // Start collapsed — only Home visible.
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.queryByText("Office")).toBeNull();

    // Expand the picker.
    fireEvent.press(screen.getByTestId("entry-edit-place-row"));

    // Office chip now visible.
    expect(screen.getByText("Office")).toBeTruthy();

    // Select Office.
    fireEvent.press(screen.getByText("Office"));

    // Picker collapses; selected label is now Office.
    // Both labels existed briefly; after collapse Office remains as the row's
    // label and Home chip is gone.
    expect(screen.getByText("Office")).toBeTruthy();
    expect(screen.queryByText("Home")).toBeNull();
  });
});

describe("EntryEditSheet — save", () => {
  it("createManual is called with converted times in New mode", () => {
    const onClose = jest.fn();
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo, places } = setup({ nowMs, mode: "new", onClose });
    fireEvent.press(screen.getByTestId("entry-edit-save"));

    const list = entriesRepo.listBetween(0, 2_000_000_000);
    expect(list).toHaveLength(1);
    const e = list[0];
    expect(e).toBeDefined();
    if (!e) return;
    const firstPlace = places[0];
    expect(firstPlace).toBeDefined();
    if (!firstPlace) return;
    expect(e.placeId).toBe(firstPlace.id);

    // Today at 09:00 local.
    const expectedStart = Math.floor(new Date(2026, 3, 17, 9, 0, 0).getTime() / 1000);
    const expectedEnd = Math.floor(new Date(2026, 3, 17, 10, 0, 0).getTime() / 1000);
    expect(e.startedAt).toBe(expectedStart);
    expect(e.endedAt).toBe(expectedEnd);
    expect(e.pauseS).toBe(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("update is called in Edit mode", () => {
    const onClose = jest.fn();
    const nowMs = new Date(2026, 3, 17, 14, 0, 0).getTime();
    const { entry, entriesRepo } = setup({
      nowMs,
      mode: "edit",
      onClose,
      entry: {
        placeIndex: 0,
        startedAtOffset: -3 * 3600,
        endedAtOffset: -2 * 3600,
        note: "old",
      },
    });
    expect(entry).not.toBeNull();
    if (!entry) return;

    // Edit the pause and the note.
    fireEvent.changeText(screen.getByTestId("entry-edit-pause"), "10");
    fireEvent.changeText(screen.getByTestId("entry-edit-note"), "new note");
    fireEvent.press(screen.getByTestId("entry-edit-save"));

    const fresh = entriesRepo.get(entry.id);
    expect(fresh?.pauseS).toBe(10 * 60);
    expect(fresh?.note).toBe("new note");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preserves the original date when editing yesterday's entry and only changing HH:MM", () => {
    // Today is 2026-04-17 12:00 local; seed an entry that started yesterday
    // at 09:00 and ended yesterday at 10:00.
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const yesterdayStart = Math.floor(new Date(2026, 3, 16, 9, 0, 0).getTime() / 1000);
    const yesterdayEnd = Math.floor(new Date(2026, 3, 16, 10, 0, 0).getTime() / 1000);

    const { entry, entriesRepo } = setup({
      nowMs,
      mode: "edit",
      entry: {
        placeIndex: 0,
        startedAtOffset: yesterdayStart - Math.floor(nowMs / 1000),
        endedAtOffset: yesterdayEnd - Math.floor(nowMs / 1000),
      },
    });
    expect(entry).not.toBeNull();
    if (!entry) return;

    // Only change the HH:MM clock of the end time.
    fireEvent.changeText(screen.getByTestId("entry-edit-end"), "11:30");
    fireEvent.press(screen.getByTestId("entry-edit-save"));

    const fresh = entriesRepo.get(entry.id);
    expect(fresh).not.toBeNull();
    if (!fresh) return;
    // Start is untouched — still yesterday 09:00.
    expect(fresh.startedAt).toBe(yesterdayStart);
    // End rolled to yesterday 11:30, NOT today 11:30.
    const expectedEnd = Math.floor(new Date(2026, 3, 16, 11, 30, 0).getTime() / 1000);
    expect(fresh.endedAt).toBe(expectedEnd);
  });

  it("rolls end forward a day when end < start (entry crosses midnight)", () => {
    // Start 22:00, end 02:00 → end + 86400.
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo } = setup({ nowMs, mode: "new" });
    fireEvent.changeText(screen.getByTestId("entry-edit-start"), "22:00");
    fireEvent.changeText(screen.getByTestId("entry-edit-end"), "02:00");
    fireEvent.press(screen.getByTestId("entry-edit-save"));

    const list = entriesRepo.listBetween(0, 2_000_000_000);
    expect(list).toHaveLength(1);
    const e = list[0];
    expect(e).toBeDefined();
    if (!e || e.endedAt == null) return;
    // Today 22:00 local, end is tomorrow 02:00 local.
    const expectedStart = Math.floor(new Date(2026, 3, 17, 22, 0, 0).getTime() / 1000);
    const expectedEnd = Math.floor(new Date(2026, 3, 18, 2, 0, 0).getTime() / 1000);
    expect(e.startedAt).toBe(expectedStart);
    expect(e.endedAt).toBe(expectedEnd);
  });
});
