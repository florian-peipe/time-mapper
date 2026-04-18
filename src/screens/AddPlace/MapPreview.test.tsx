import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { MapPreview } from "./MapPreview";

function setup(props?: Partial<React.ComponentProps<typeof MapPreview>>) {
  return render(
    <ThemeProvider schemeOverride="light">
      <MapPreview
        latitude={50.9613}
        longitude={6.9585}
        radiusM={100}
        color="#FF6A3D"
        testID="map"
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("MapPreview", () => {
  it("renders the map container with the expected testID when react-native-maps loads", () => {
    const { getByTestId } = setup();
    // jest.setup.ts mocks react-native-maps to a passthrough View, so the
    // component tree includes both the wrapper and the mock MapView.
    expect(getByTestId("map")).toBeTruthy();
  });

  it("renders the accessibility label for the map view", () => {
    const { getByTestId } = setup();
    // Wrapper View carries the a11y label.
    const node = getByTestId("map");
    expect(node.props.accessibilityLabel).toContain("Map preview");
  });

  it("sets the image accessibility role so screen readers announce it as a graphic", () => {
    const { getByTestId } = setup();
    expect(getByTestId("map").props.accessibilityRole).toBe("image");
  });

  it("rounds corners and fixes the height to a 180-pt viewport", () => {
    const { getByTestId } = setup();
    const style = getByTestId("map").props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.height).toBe(180);
    expect(flat.borderRadius).toBeGreaterThan(0);
  });
});
