import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { makePlace } from "@/features/places/testFixtures";
import { PlacesMapView } from "./PlacesMapView";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

describe("PlacesMapView", () => {
  it("renders a MapView with one Marker + one Circle per place (native maps path)", () => {
    const places = [
      makePlace("a", { name: "Home", latitude: 50.96, longitude: 6.95 }),
      makePlace("b", { name: "Office", latitude: 50.97, longitude: 6.97 }),
      makePlace("c", { name: "Gym", latitude: 50.95, longitude: 6.94 }),
    ];
    const { getByTestId, getAllByTestId } = render(
      wrap(<PlacesMapView places={places} onPressPlace={jest.fn()} />),
    );
    expect(getByTestId("mock-mapview")).toBeTruthy();
    expect(getAllByTestId("mock-marker")).toHaveLength(3);
    expect(getAllByTestId("mock-circle")).toHaveLength(3);
  });

  it("renders without crashing for an empty places list (uses Köln default region)", () => {
    const { getByTestId, queryAllByTestId } = render(
      wrap(<PlacesMapView places={[]} onPressPlace={jest.fn()} />),
    );
    expect(getByTestId("mock-mapview")).toBeTruthy();
    expect(queryAllByTestId("mock-marker")).toHaveLength(0);
  });
});

// NOTE: the Expo-Go fallback branch (`if (!Maps) return <Banner>`) is a
// trivial one-line guard. Exercising it in Jest requires `jest.resetModules`
// + `jest.doMock("@/lib/nativeMaps", …)`, which loads a second copy of React
// and fires "invalid hook call" at render time. The branch is visually
// covered by the manual "no Maps key configured" smoke test in docs/STATUS.md.
