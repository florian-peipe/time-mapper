import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Phase1SearchStep } from "./Phase1SearchStep";
import type { PlaceSuggestion } from "@/lib/geocode";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

const SUGGESTIONS: PlaceSuggestion[] = [
  {
    placeId: "osm:1",
    description: "Ehrenstraße 10, 50672 Köln",
    mainText: "Ehrenstraße 10",
    secondaryText: "50672 Köln",
  },
  {
    placeId: "osm:2",
    description: "Mediapark 8, 50670 Köln",
    mainText: "Mediapark 8",
    secondaryText: "50670 Köln",
  },
];

describe("Phase1SearchStep", () => {
  it("forwards search input changes via onChangeQuery", () => {
    const onChangeQuery = jest.fn();
    const { getByTestId } = render(
      wrap(
        <Phase1SearchStep
          query=""
          suggestions={[]}
          searching={false}
          apiError={null}
          onChangeQuery={onChangeQuery}
          onPickSuggestion={jest.fn()}
        />,
      ),
    );
    fireEvent.changeText(getByTestId("add-place-search"), "ehren");
    expect(onChangeQuery).toHaveBeenCalledWith("ehren");
  });

  it("renders one row per suggestion and fires onPickSuggestion with the picked item", () => {
    const onPick = jest.fn();
    const { getByTestId } = render(
      wrap(
        <Phase1SearchStep
          query="ehren"
          suggestions={SUGGESTIONS}
          searching={false}
          apiError={null}
          onChangeQuery={jest.fn()}
          onPickSuggestion={onPick}
        />,
      ),
    );
    fireEvent.press(getByTestId("add-place-suggestion-1"));
    expect(onPick).toHaveBeenCalledWith(SUGGESTIONS[1]);
  });

  it("shows the 'searching…' indicator when searching is true", () => {
    const { getByTestId, queryByTestId, rerender } = render(
      wrap(
        <Phase1SearchStep
          query="eh"
          suggestions={[]}
          searching={false}
          apiError={null}
          onChangeQuery={jest.fn()}
          onPickSuggestion={jest.fn()}
        />,
      ),
    );
    expect(queryByTestId("add-place-searching")).toBeNull();
    rerender(
      wrap(
        <Phase1SearchStep
          query="eh"
          suggestions={[]}
          searching
          apiError={null}
          onChangeQuery={jest.fn()}
          onPickSuggestion={jest.fn()}
        />,
      ),
    );
    expect(getByTestId("add-place-searching")).toBeTruthy();
  });

  it("surfaces apiError as a warning banner", () => {
    const { getByTestId } = render(
      wrap(
        <Phase1SearchStep
          query="ehren"
          suggestions={[]}
          searching={false}
          apiError="photon unreachable"
          onChangeQuery={jest.fn()}
          onPickSuggestion={jest.fn()}
        />,
      ),
    );
    expect(getByTestId("add-place-api-error")).toBeTruthy();
  });
});
