import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { resetProMock } from "@/features/billing/useProMock";
import { SheetHost } from "./SheetHost";

function mount() {
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db);
  const entriesRepo = new EntriesRepo(db);
  const utils = render(
    <ThemeProvider schemeOverride="light">
      <PlacesRepoProvider value={placesRepo}>
        <EntriesRepoProvider value={entriesRepo}>
          <SheetHost />
        </EntriesRepoProvider>
      </PlacesRepoProvider>
    </ThemeProvider>,
  );
  return { ...utils, placesRepo, entriesRepo };
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  resetProMock();
});

describe("SheetHost", () => {
  it("mounts with all three sheets hidden initially", () => {
    mount();

    // Each sheet's testID comes from the underlying RN Modal, which is still
    // in the tree while the Sheet primitive is `visible=false`. We assert the
    // user-visible content is absent for each sheet to prove hidden state.
    expect(screen.queryByText("Track every place that matters.")).toBeNull(); // Paywall hero
    expect(screen.queryByText("New entry")).toBeNull(); // EntryEdit (new mode)
    expect(screen.queryByText("Edit entry")).toBeNull(); // EntryEdit (edit mode)
    expect(screen.queryByText("Add place")).toBeNull(); // AddPlace title
  });

  it("renders the paywall sheet when active=paywall", () => {
    mount();
    act(() => {
      useSheetStore.getState().openSheet("paywall", { source: "settings" });
    });
    // Paywall hero is now visible; neither other sheet's body is.
    expect(screen.getByText("Track every place that matters.")).toBeTruthy();
    expect(screen.queryByText("New entry")).toBeNull();
    expect(screen.queryByText("Add place")).toBeNull();
  });

  it("switches to entryEdit and hides the paywall", () => {
    mount();
    act(() => {
      useSheetStore.getState().openSheet("paywall", { source: "settings" });
    });
    expect(screen.getByText("Track every place that matters.")).toBeTruthy();

    act(() => {
      useSheetStore.getState().openSheet("entryEdit", { entryId: null });
    });
    // Paywall hero gone; EntryEditSheet (new mode) title visible.
    expect(screen.queryByText("Track every place that matters.")).toBeNull();
    expect(screen.getByText("New entry")).toBeTruthy();
  });

  it("renders AddPlaceSheet when active=addPlace", () => {
    mount();
    act(() => {
      useSheetStore.getState().openSheet("addPlace", { placeId: null });
    });
    expect(screen.getByText("Add place")).toBeTruthy();
    expect(screen.queryByText("Track every place that matters.")).toBeNull();
    expect(screen.queryByText("New entry")).toBeNull();
  });

  it("hides everything when closeSheet is called", () => {
    mount();
    act(() => {
      useSheetStore.getState().openSheet("paywall", { source: "settings" });
    });
    expect(screen.getByText("Track every place that matters.")).toBeTruthy();

    act(() => {
      useSheetStore.getState().closeSheet();
    });
    expect(screen.queryByText("Track every place that matters.")).toBeNull();
    expect(screen.queryByText("New entry")).toBeNull();
    expect(screen.queryByText("Add place")).toBeNull();
  });

  it("narrows entryId from the payload when opening entryEdit with an id", () => {
    const { entriesRepo, placesRepo } = mount();
    // Seed a place + entry so EntryEditSheet can hydrate in edit mode.
    const place = placesRepo.create({
      name: "Home",
      address: "",
      latitude: 0,
      longitude: 0,
    });
    const entry = entriesRepo.createManual({
      placeId: place.id,
      startedAt: 1_700_000_000,
      endedAt: 1_700_003_600,
      note: "seeded note",
    });

    act(() => {
      useSheetStore.getState().openSheet("entryEdit", { entryId: entry.id });
    });

    // Edit-mode title appears and the hydrated note is visible.
    expect(screen.getByText("Edit entry")).toBeTruthy();
    expect(screen.getByTestId("entry-edit-note").props.value).toBe("seeded note");
  });
});
