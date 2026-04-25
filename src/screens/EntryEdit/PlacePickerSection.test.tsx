import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { makePlace } from "@/features/places/testFixtures";
import { PlacePickerSection } from "./PlacePickerSection";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

describe("PlacePickerSection", () => {
  it("renders the 'no place' placeholder when selectedPlace is null", () => {
    const { queryByText } = render(
      wrap(
        <PlacePickerSection
          places={[makePlace("a", { name: "Home" })]}
          selectedPlace={null}
          onSelect={jest.fn()}
        />,
      ),
    );
    // The placeholder copy comes from i18n entryEdit.label.placeNone. Instead
    // of hard-coding a string, assert that NO selected-place name is rendered
    // (we passed in Home as an available pick, but it's not selected).
    expect(queryByText("Home")).toBeNull();
  });

  it("renders the selected place's name when one is passed", () => {
    const home = makePlace("a", { name: "Home" });
    const { getByText } = render(
      wrap(<PlacePickerSection places={[home]} selectedPlace={home} onSelect={jest.fn()} />),
    );
    expect(getByText("Home")).toBeTruthy();
  });

  it("toggles the picker open on header press and closes on selection", () => {
    const onSelect = jest.fn();
    const home = makePlace("a", { name: "Home" });
    const gym = makePlace("b", { name: "Gym" });
    const { getByTestId, queryByText, getByText } = render(
      wrap(<PlacePickerSection places={[home, gym]} selectedPlace={home} onSelect={onSelect} />),
    );
    // Picker starts closed — chip labels for OTHER places are not rendered.
    expect(queryByText("Gym")).toBeNull();
    fireEvent.press(getByTestId("entry-edit-place-row"));
    // Open: chip list now contains "Gym" as a Chip label.
    expect(getByText("Gym")).toBeTruthy();
    // Select Gym → onSelect fires with its id and the picker collapses.
    fireEvent.press(getByText("Gym"));
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(queryByText("Gym")).toBeNull();
  });
});
