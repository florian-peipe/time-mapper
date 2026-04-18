import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { PlacesRepo } from "@/db/repository/places";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { grantProMock, resetProMock } from "@/features/billing/useProMock";
import { AddPlaceSheet } from "./AddPlaceSheet";

function setup(opts: {
  onClose?: () => void;
  /** Optionally seed pre-existing places (for Pro gate tests). */
  preSeeded?: { name: string }[];
}) {
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db);

  for (const p of opts.preSeeded ?? []) {
    placesRepo.create({
      name: p.name,
      address: "seed",
      latitude: 0,
      longitude: 0,
    });
  }

  const onClose = opts.onClose ?? jest.fn();

  const utils = render(
    <ThemeProvider schemeOverride="light">
      <PlacesRepoProvider value={placesRepo}>
        <AddPlaceSheet visible placeId={null} onClose={onClose} />
      </PlacesRepoProvider>
    </ThemeProvider>,
  );

  return { ...utils, placesRepo, onClose };
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
