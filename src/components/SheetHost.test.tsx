import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { __setProForTests } from "@/features/billing/usePro";
import { SheetHost } from "./SheetHost";

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
}));

function mount() {
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db);
  const entriesRepo = new EntriesRepo(db);
  const kvRepo = new KvRepo(db);
  const utils = render(
    <ThemeProvider schemeOverride="light">
      <KvRepoProvider value={kvRepo}>
        <PlacesRepoProvider value={placesRepo}>
          <EntriesRepoProvider value={entriesRepo}>
            <SheetHost />
          </EntriesRepoProvider>
        </PlacesRepoProvider>
      </KvRepoProvider>
    </ThemeProvider>,
  );
  return { ...utils, placesRepo, entriesRepo, kvRepo };
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  __setProForTests(null);
  mockRouterReplace.mockReset();
  mockRouterPush.mockReset();
});

describe("SheetHost", () => {
  it("mounts with both sheets hidden initially", () => {
    mount();
    expect(screen.queryByText("New entry")).toBeNull();
    expect(screen.queryByText("Edit entry")).toBeNull();
    expect(screen.queryByText("Add place")).toBeNull();
  });

  it("renders EntryEditSheet when active=entryEdit", () => {
    mount();
    act(() => {
      useSheetStore.getState().openSheet("entryEdit", { entryId: null });
    });
    expect(screen.getByText("New entry")).toBeTruthy();
    expect(screen.queryByText("Add place")).toBeNull();
  });

  it("renders AddPlaceSheet when active=addPlace", () => {
    mount();
    act(() => {
      useSheetStore.getState().openSheet("addPlace", { placeId: null });
    });
    expect(screen.getByText("Add place")).toBeTruthy();
    expect(screen.queryByText("New entry")).toBeNull();
  });

  it("hides everything when closeSheet is called", () => {
    mount();
    act(() => {
      useSheetStore.getState().openSheet("entryEdit", { entryId: null });
    });
    expect(screen.getByText("New entry")).toBeTruthy();

    act(() => {
      useSheetStore.getState().closeSheet();
    });
    expect(screen.queryByText("New entry")).toBeNull();
    expect(screen.queryByText("Add place")).toBeNull();
  });

  it("narrows entryId from the payload when opening entryEdit with an id", () => {
    const { entriesRepo, placesRepo } = mount();
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

    expect(screen.getByText("Edit entry")).toBeTruthy();
    expect(screen.getByTestId("entry-edit-note").props.value).toBe("seeded note");
  });
});
