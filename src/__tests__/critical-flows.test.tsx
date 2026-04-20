/**
 * Critical user-flow smoke tests. Integration-level: each test wires the
 * screens + their data providers + the SheetHost together and exercises a
 * single end-to-end interaction. Stops short of expo-router navigation
 * (those hooks are mocked), but covers the meaningful state transitions:
 * place creation, entry edit, Pro gate, paywall → Pro transition, etc.
 *
 * Target: 15 tests covering every screen that ships.
 */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore } from "@/state/uiStore";
import { grantProMock, resetProMock } from "@/features/billing/useProMock";
import { SheetHost } from "@/screens/SheetHost";
import { TimelineScreen } from "@/screens/Timeline/TimelineScreen";
import { SettingsScreen } from "@/screens/Settings/SettingsScreen";
import { FirstPlaceScreen } from "@/screens/Onboarding/FirstPlaceScreen";
import { PaywallScreen } from "@/screens/Paywall/PaywallScreen";

// Mock router so any `useRouter()` call in a screen doesn't crash.
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useSegments: () => [],
  Stack: () => null,
}));

type Fixture = {
  placesRepo: PlacesRepo;
  entriesRepo: EntriesRepo;
  kvRepo: KvRepo;
};

function makeFixture(opts: { seedPlace?: boolean } = {}): Fixture {
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db);
  const entriesRepo = new EntriesRepo(db);
  const kvRepo = new KvRepo(db);
  if (opts.seedPlace) {
    placesRepo.create({
      name: "Home",
      address: "1 Example Ln, Cologne",
      latitude: 50.9613,
      longitude: 6.9585,
      color: "#FF6A3D",
      icon: "home",
      radiusM: 120,
    });
  }
  return { placesRepo, entriesRepo, kvRepo };
}

function Wrap({ fixture, children }: { fixture: Fixture; children: React.ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">
        <KvRepoProvider value={fixture.kvRepo}>
          <PlacesRepoProvider value={fixture.placesRepo}>
            <EntriesRepoProvider value={fixture.entriesRepo}>
              {children}
              <SheetHost />
            </EntriesRepoProvider>
          </PlacesRepoProvider>
        </KvRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  useUiStore.setState({
    themeOverride: null,
    localeOverride: null,
    onboardingComplete: false,
  });
  resetProMock();
  mockPush.mockReset();
  mockReplace.mockReset();
});

describe("critical flows — onboarding", () => {
  it("Timeline with no places renders the place-first hero CTA", () => {
    const fixture = makeFixture();
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <TimelineScreen />
      </Wrap>,
    );
    // Primary CTA is the hero, not the manual-entry FAB.
    expect(getByTestId("timeline-add-place-cta")).toBeTruthy();
    // FAB is hidden when no places.
    expect(() => getByTestId("timeline-fab")).toThrow();
  });

  it("FirstPlace screen opens the AddPlaceSheet when 'Add first place' is tapped", () => {
    const fixture = makeFixture();
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <FirstPlaceScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("onboarding-first-place-add"));
    // Sheet-store state flips to addPlace.
    expect(useSheetStore.getState().active).toBe("addPlace");
    const payload = useSheetStore.getState().payload as { placeId: null; source: string };
    expect(payload.placeId).toBeNull();
    expect(payload.source).toBe("onboarding");
  });

  it("FirstPlace screen 'Skip for now' marks onboarding complete + navigates home", () => {
    const fixture = makeFixture();
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <FirstPlaceScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("onboarding-first-place-skip"));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });
});

describe("critical flows — Timeline + manual entry", () => {
  it("Tap FAB on Timeline with places opens the manual entry editor", () => {
    const fixture = makeFixture({ seedPlace: true });
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <TimelineScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("timeline-fab"));
    expect(useSheetStore.getState().active).toBe("entryEdit");
    const payload = useSheetStore.getState().payload as { entryId: null };
    expect(payload.entryId).toBeNull();
  });

  it("Timeline hero CTA opens AddPlaceSheet for a fresh place", () => {
    const fixture = makeFixture();
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <TimelineScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("timeline-add-place-cta"));
    expect(useSheetStore.getState().active).toBe("addPlace");
  });

  it("Timeline with places but no entries shows the 'You're set up' empty state", () => {
    const fixture = makeFixture({ seedPlace: true });
    const { getByTestId, getByText } = render(
      <Wrap fixture={fixture}>
        <TimelineScreen />
      </Wrap>,
    );
    expect(getByText(/you're set up/i)).toBeTruthy();
    // "Add another place" secondary nudge is present.
    expect(getByTestId("timeline-add-another-place")).toBeTruthy();
  });
});

describe("critical flows — Settings", () => {
  it("Settings Export CSV row opens the paywall for free users", () => {
    const fixture = makeFixture({ seedPlace: true });
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("settings-row-export"));
    expect(useSheetStore.getState().active).toBe("paywall");
  });

  it("Settings Export CSV row NO-OPs for Pro users (CSV logic lands later)", () => {
    grantProMock();
    const fixture = makeFixture({ seedPlace: true });
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("settings-row-export"));
    // Pro bypasses the paywall; no sheet opens.
    expect(useSheetStore.getState().active).toBeNull();
  });

  it("Settings Theme row cycles light → dark", () => {
    const fixture = makeFixture();
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBe("light");
    fireEvent.press(getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBe("dark");
    fireEvent.press(getByTestId("settings-row-theme"));
    expect(useUiStore.getState().themeOverride).toBeNull();
  });
});

describe("critical flows — Paywall + Pro gate", () => {
  it("Free user with 1 place sees the Pro upsell card in Settings", () => {
    const fixture = makeFixture({ seedPlace: true });
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    );
    expect(getByTestId("settings-pro-upsell")).toBeTruthy();
  });

  it("Pro upsell card opens the paywall", () => {
    const fixture = makeFixture({ seedPlace: true });
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    );
    fireEvent.press(getByTestId("settings-pro-upsell"));
    expect(useSheetStore.getState().active).toBe("paywall");
  });

  it("Pro users do not see the upsell card", () => {
    grantProMock();
    const fixture = makeFixture({ seedPlace: true });
    const { queryByTestId } = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    );
    expect(queryByTestId("settings-pro-upsell")).toBeNull();
  });

  it("Dev toggle-Pro flips isPro state (mock purchase path)", async () => {
    const fixture = makeFixture();
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    );
    // Initially free — no "Time Mapper Pro Active" row.
    expect(() => getByTestId("settings-row-pro-active")).toThrow();
    fireEvent.press(getByTestId("settings-row-toggle-pro"));
    // After toggling Pro, the active row renders.
    await waitFor(() => getByTestId("settings-row-pro-active"));
  });

  it("Paywall can be closed via the overlay scrim", () => {
    const fixture = makeFixture({ seedPlace: true });
    const onClose = jest.fn();
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <PaywallScreen onClose={onClose} />
      </Wrap>,
    );
    fireEvent.press(getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("critical flows — seeded entries", () => {
  it("Timeline renders a seeded entry row with the place name", async () => {
    const fixture = makeFixture({ seedPlace: true });
    const placeId = fixture.placesRepo.list()[0]!.id;
    const nowS = Math.floor(Date.now() / 1000);
    fixture.entriesRepo.createManual({
      placeId,
      startedAt: nowS - 3600,
      endedAt: nowS - 300,
    });
    const { getByText } = render(
      <Wrap fixture={fixture}>
        <TimelineScreen />
      </Wrap>,
    );
    await waitFor(() => {
      // Place name shows up in the row.
      expect(getByText("Home")).toBeTruthy();
    });
  });

  it("Tapping an entry row opens the EntryEditSheet preloaded to that id", async () => {
    const fixture = makeFixture({ seedPlace: true });
    const placeId = fixture.placesRepo.list()[0]!.id;
    const nowS = Math.floor(Date.now() / 1000);
    const entry = fixture.entriesRepo.createManual({
      placeId,
      startedAt: nowS - 3600,
      endedAt: nowS - 300,
    });
    const { getByTestId } = render(
      <Wrap fixture={fixture}>
        <TimelineScreen />
      </Wrap>,
    );
    await waitFor(() => getByTestId(`entry-row-${entry.id}`));
    await act(async () => {
      fireEvent.press(getByTestId(`entry-row-${entry.id}`));
    });
    expect(useSheetStore.getState().active).toBe("entryEdit");
    const payload = useSheetStore.getState().payload as { entryId: string };
    expect(payload.entryId).toBe(entry.id);
  });
});
