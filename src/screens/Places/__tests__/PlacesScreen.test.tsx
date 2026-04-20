import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { PlacesRepo } from "@/db/repository/places";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { PlacesScreen } from "../PlacesScreen";

function wrap(ui: React.ReactNode, repo: PlacesRepo) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">
        <PlacesRepoProvider value={repo}>{ui}</PlacesRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function seededRepo(...names: string[]): PlacesRepo {
  const repo = new PlacesRepo(createTestDb());
  for (const n of names) {
    repo.create({ name: n, address: "", latitude: 0, longitude: 0 });
  }
  return repo;
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
});

describe("PlacesScreen", () => {
  it("renders the empty state when there are no places, with a CTA that opens AddPlaceSheet", () => {
    const repo = seededRepo();
    render(wrap(<PlacesScreen />, repo));
    expect(screen.getByTestId("places-empty-add")).toBeTruthy();
    fireEvent.press(screen.getByTestId("places-empty-add"));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({
      placeId: null,
      source: "places-tab",
    });
  });

  it("renders the map-mode toggle + FAB once at least one place exists", () => {
    const repo = seededRepo("Home", "Work");
    render(wrap(<PlacesScreen />, repo));
    expect(screen.getByTestId("places-toggle-map")).toBeTruthy();
    expect(screen.getByTestId("places-toggle-list")).toBeTruthy();
    expect(screen.getByTestId("places-fab-add")).toBeTruthy();
  });

  it("switching to list mode renders a row per saved place, and tapping it opens edit", () => {
    const repo = seededRepo("Home", "Work");
    const [home, work] = repo.list();
    render(wrap(<PlacesScreen />, repo));

    fireEvent.press(screen.getByTestId("places-toggle-list"));
    expect(screen.getByTestId(`places-list-row-${home!.id}`)).toBeTruthy();
    expect(screen.getByTestId(`places-list-row-${work!.id}`)).toBeTruthy();

    fireEvent.press(screen.getByTestId(`places-list-row-${home!.id}`));
    expect(useSheetStore.getState().active).toBe("addPlace");
    const payload = useSheetStore.getState().payload as { placeId: string | null };
    expect(payload.placeId).toBe(home!.id);
  });

  it("FAB opens AddPlaceSheet in new-place mode", () => {
    const repo = seededRepo("Home");
    render(wrap(<PlacesScreen />, repo));
    fireEvent.press(screen.getByTestId("places-fab-add"));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({
      placeId: null,
      source: "places-tab",
    });
  });
});
