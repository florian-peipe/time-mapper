import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { PlacesRepo } from "@/db/repository/places";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { grantProMock, resetProMock } from "@/features/billing/useProMock";
import { AddPlaceSheet } from "./AddPlaceSheet";

type SeedPlace = {
  name: string;
  address?: string;
  color?: string;
  icon?: string;
  radiusM?: number;
};

function setup(opts: {
  onClose?: () => void;
  onSaved?: (placeId: string) => void;
  /** Optionally seed pre-existing places (for Pro gate tests). */
  preSeeded?: SeedPlace[];
  /** If set, the sheet opens in edit mode for the Nth pre-seeded place. */
  editingIndex?: number;
}) {
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db);

  const seeded = (opts.preSeeded ?? []).map((p) =>
    placesRepo.create({
      name: p.name,
      address: p.address ?? "seed",
      latitude: 0,
      longitude: 0,
      color: p.color,
      icon: p.icon,
      radiusM: p.radiusM,
    }),
  );

  const onClose = opts.onClose ?? jest.fn();
  const onSaved = opts.onSaved;
  const editPlaceId = opts.editingIndex != null ? (seeded[opts.editingIndex]?.id ?? null) : null;

  const utils = render(
    <ThemeProvider schemeOverride="light">
      <PlacesRepoProvider value={placesRepo}>
        <AddPlaceSheet visible placeId={editPlaceId} onClose={onClose} onSaved={onSaved} />
      </PlacesRepoProvider>
    </ThemeProvider>,
  );

  return { ...utils, placesRepo, onClose, seeded };
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  resetProMock();
});

describe("AddPlaceSheet — Phase 1 (search)", () => {
  it("renders the 'Add place' title and a search input", () => {
    setup({});
    expect(screen.getByText("Add place")).toBeTruthy();
    expect(screen.getByTestId("add-place-search")).toBeTruthy();
  });

  it("renders all hardcoded suggestions before the user types", () => {
    setup({});
    expect(screen.getByText(/Kinkelstr\. 3, 50733 Köln/)).toBeTruthy();
    expect(screen.getByText(/Mediapark 8, 50670 Köln/)).toBeTruthy();
    expect(screen.getByText(/Kinkel Straße 12, Düsseldorf/)).toBeTruthy();
  });

  it("filters suggestions on query (case-insensitive)", () => {
    setup({});
    fireEvent.changeText(screen.getByTestId("add-place-search"), "medi");
    expect(screen.getByText(/Mediapark 8, 50670 Köln/)).toBeTruthy();
    expect(screen.queryByText(/Kinkelstr\. 3/)).toBeNull();
    expect(screen.queryByText(/Kinkel Straße 12/)).toBeNull();
  });

  it("filters out all rows when nothing matches", () => {
    setup({});
    fireEvent.changeText(screen.getByTestId("add-place-search"), "zzznomatch");
    expect(screen.queryByText(/Kinkelstr/)).toBeNull();
    expect(screen.queryByText(/Mediapark/)).toBeNull();
  });
});

describe("AddPlaceSheet — Phase 2 (editor)", () => {
  function gotoPhase2() {
    setup({});
    // Tap the first suggestion — switches to the editor view.
    fireEvent.press(screen.getByText(/Kinkelstr\. 3, 50733 Köln/));
  }

  it("enters the editor after selecting a suggestion and pre-fills the name", () => {
    gotoPhase2();
    // Name input pre-filled with first part of address.
    expect(screen.getByTestId("add-place-name").props.value).toBe("Kinkelstr. 3");
    // Address preview shown.
    expect(screen.getByText("Kinkelstr. 3, 50733 Köln")).toBeTruthy();
  });

  it("renders radius label and initial value 100 m", () => {
    gotoPhase2();
    expect(screen.getByText("Geofence radius")).toBeTruthy();
    expect(screen.getByText("100 m")).toBeTruthy();
  });

  it("updates the radius label when the slider value changes", () => {
    gotoPhase2();
    const slider = screen.getByTestId("add-place-radius");
    fireEvent(slider, "valueChange", 225);
    expect(screen.getByText("225 m")).toBeTruthy();
  });

  it("renders 8 color swatches", () => {
    gotoPhase2();
    for (let i = 0; i < 8; i++) {
      expect(screen.getByTestId(`add-place-color-${i}`)).toBeTruthy();
    }
  });

  it("tapping a color swatch updates the selection", () => {
    gotoPhase2();
    // Initially swatch #0 is selected.
    expect(screen.getByTestId("add-place-color-0").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    fireEvent.press(screen.getByTestId("add-place-color-3"));
    expect(screen.getByTestId("add-place-color-3").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId("add-place-color-0").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("renders 9 icon tiles", () => {
    gotoPhase2();
    for (let i = 0; i < 9; i++) {
      expect(screen.getByTestId(`add-place-icon-${i}`)).toBeTruthy();
    }
  });

  it("tapping an icon updates the selection", () => {
    gotoPhase2();
    expect(screen.getByTestId("add-place-icon-0").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    fireEvent.press(screen.getByTestId("add-place-icon-4"));
    expect(screen.getByTestId("add-place-icon-4").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId("add-place-icon-0").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });
});

describe("AddPlaceSheet — Save", () => {
  it("Save button CTA reads 'Save place' on an empty-places free user", () => {
    const { placesRepo } = setup({});
    expect(placesRepo.count()).toBe(0);
    // Enter phase 2 then inspect the CTA.
    fireEvent.press(screen.getByText(/Kinkelstr\. 3/));
    expect(screen.getByText("Save place")).toBeTruthy();
  });

  it("calls placesRepo.create with the edited fields and closes", () => {
    const onClose = jest.fn();
    const { placesRepo } = setup({ onClose });
    fireEvent.press(screen.getByText(/Mediapark 8, 50670 Köln/));
    // Change the name.
    fireEvent.changeText(screen.getByTestId("add-place-name"), "Studio");
    // Switch to icon 2 (dumbbell).
    fireEvent.press(screen.getByTestId("add-place-icon-2"));
    // Switch to color 4.
    fireEvent.press(screen.getByTestId("add-place-color-4"));
    // Drag radius to 200.
    fireEvent(screen.getByTestId("add-place-radius"), "valueChange", 200);
    // Save.
    fireEvent.press(screen.getByTestId("add-place-save"));

    expect(onClose).toHaveBeenCalledTimes(1);
    const list = placesRepo.list();
    expect(list).toHaveLength(1);
    const p = list[0];
    expect(p).toBeDefined();
    if (!p) return;
    expect(p.name).toBe("Studio");
    expect(p.address).toBe("Mediapark 8, 50670 Köln");
    expect(p.radiusM).toBe(200);
    // Color index 4 from PLACE_COLORS.
    expect(p.color).toBe("#C98A10");
    // Icon index 2 → 'dumbbell'.
    expect(p.icon).toBe("dumbbell");
  });
});

describe("AddPlaceSheet — Edit mode", () => {
  it("skips phase 1 and jumps straight into phase 2 with fields pre-filled", () => {
    setup({
      preSeeded: [
        {
          name: "Home",
          address: "1 Example Ln",
          color: "#FF6A3D",
          icon: "home",
          radiusM: 175,
        },
      ],
      editingIndex: 0,
    });
    // Title changes in edit mode.
    expect(screen.getByText("Edit place")).toBeTruthy();
    // Phase-1 search is absent; we're in phase 2 with hydrated fields.
    expect(screen.queryByTestId("add-place-search")).toBeNull();
    expect(screen.getByTestId("add-place-name").props.value).toBe("Home");
    expect(screen.getByText("1 Example Ln")).toBeTruthy();
    expect(screen.getByText("175 m")).toBeTruthy();
    expect(screen.getByText("Save changes")).toBeTruthy();
    // Delete button only visible in edit mode.
    expect(screen.getByTestId("add-place-delete")).toBeTruthy();
  });

  it("saving in edit mode calls repo.update and invokes onSaved+onClose", () => {
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const { placesRepo, seeded } = setup({
      preSeeded: [{ name: "Home", color: "#FF6A3D" }],
      editingIndex: 0,
      onClose,
      onSaved,
    });
    fireEvent.changeText(screen.getByTestId("add-place-name"), "House");
    fireEvent.press(screen.getByTestId("add-place-save"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(seeded[0]!.id);
    const list = placesRepo.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("House");
  });

  it("tapping Delete opens the Alert and calling the destructive action removes the place", () => {
    // Stub react-native's Alert.alert so we can invoke the destructive handler
    // synchronously in the test. The real Alert is native and can't render.
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {
      // no-op until we invoke the button below
    });

    const onClose = jest.fn();
    const { placesRepo } = setup({
      preSeeded: [{ name: "Home" }],
      editingIndex: 0,
      onClose,
    });

    fireEvent.press(screen.getByTestId("add-place-delete"));
    // Alert was called once with our title + buttons.
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const call = alertSpy.mock.calls[0]!;
    expect(call[0]).toBe("Delete place?");
    const buttons = call[2] as readonly {
      text: string;
      onPress?: () => void;
      style?: string;
    }[];
    // The "Delete" destructive button triggers the real repo.softDelete.
    const deleteBtn = buttons.find((b) => b.text === "Delete");
    expect(deleteBtn).toBeDefined();
    deleteBtn?.onPress?.();
    // Post-confirmation: the place list is empty and the sheet has closed.
    expect(placesRepo.list()).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("edit mode does NOT trip the Pro gate even with >=1 places on free", () => {
    setup({
      preSeeded: [
        { name: "Home" },
        { name: "Gym" }, // second place — would be gated in NEW mode
      ],
      editingIndex: 1,
    });
    // Editing the existing second place is fine: the Save CTA reads
    // "Save changes" regardless of the free-plan place limit.
    expect(screen.getByText("Save changes")).toBeTruthy();
    expect(screen.queryByText("Unlock more places with Pro")).toBeNull();
  });
});

describe("AddPlaceSheet — Pro gate", () => {
  it("CTA label becomes 'Unlock more places with Pro' when !isPro and places.length >= 1", () => {
    setup({ preSeeded: [{ name: "Home" }] });
    // Non-Pro user, 1 place already exists.
    fireEvent.press(screen.getByText(/Kinkelstr\. 3/));
    expect(screen.getByText("Unlock more places with Pro")).toBeTruthy();
    expect(screen.queryByText("Save place")).toBeNull();
  });

  it("CTA remains 'Save place' for a Pro user even with a pre-seeded place", () => {
    grantProMock();
    setup({ preSeeded: [{ name: "Home" }] });
    fireEvent.press(screen.getByText(/Kinkelstr\. 3/));
    expect(screen.getByText("Save place")).toBeTruthy();
    expect(screen.queryByText("Unlock more places with Pro")).toBeNull();
  });

  it("tapping the Pro-gated CTA opens the paywall sheet and does NOT create a place", () => {
    const onClose = jest.fn();
    const { placesRepo } = setup({ onClose, preSeeded: [{ name: "Home" }] });
    fireEvent.press(screen.getByText(/Kinkelstr\. 3/));
    fireEvent.press(screen.getByTestId("add-place-save"));

    // Paywall opened.
    expect(useSheetStore.getState().active).toBe("paywall");
    // Only the pre-seeded place remains — no new one created.
    expect(placesRepo.list()).toHaveLength(1);
    // Caller's onClose is NOT fired — the AddPlaceSheet defers to the paywall
    // transition and lets the host close later.
    expect(onClose).not.toHaveBeenCalled();
  });
});
