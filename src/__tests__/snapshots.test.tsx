/**
 * Snapshot smoke tests for the 6 main screens. Catches unintentional visual
 * or markup regressions between commits. To regenerate after a deliberate
 * change: `npx jest src/__tests__/snapshots.test.tsx -u`.
 *
 * Notes on stability:
 * - We fix the theme to `light` so tokens are deterministic.
 * - Uses a deterministic SafeArea inset + device size so SafeAreaView math
 *   doesn't drift across test environments.
 * - Mocks expo-router + time functions so snapshots don't capture `new Date()`.
 */
import React from "react";
import { render } from "@testing-library/react-native";
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
import { resetProMock } from "@/features/billing/useProMock";
import { TimelineScreen } from "@/screens/Timeline/TimelineScreen";
import { StatsScreen } from "@/screens/Stats/StatsScreen";
import { SettingsScreen } from "@/screens/Settings/SettingsScreen";
import { PaywallScreen } from "@/screens/Paywall/PaywallScreen";
import { EntryEditSheet } from "@/screens/EntryEdit/EntryEditSheet";
import { AddPlaceSheet } from "@/screens/AddPlace/AddPlaceSheet";

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useSegments: () => [],
  Stack: () => null,
}));

// Freeze Date.now so any `new Date()` inside screens (range labels, etc.)
// produces the same output between runs.
const FIXED_NOW = new Date("2026-04-17T10:00:00Z").getTime();

function makeFixture(seedPlace = true) {
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db);
  const entriesRepo = new EntriesRepo(db);
  const kvRepo = new KvRepo(db);
  if (seedPlace) {
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

/**
 * Snapshot post-processor: replaces dynamic UUID fragments in node props with
 * a stable placeholder, so places/entries created fresh for each test don't
 * churn the snapshot file. Targets testID, accessibilityLabel, and `key`
 * strings that embed the UUIDs.
 */
function stableSnapshot(tree: unknown): unknown {
  const re = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const normalize = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(re, "STABLE_UUID");
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = normalize(val);
      return out;
    }
    return v;
  };
  return normalize(tree);
}

function Wrap({
  children,
  fixture,
}: {
  children: React.ReactNode;
  fixture: ReturnType<typeof makeFixture>;
}) {
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
            <EntriesRepoProvider value={fixture.entriesRepo}>{children}</EntriesRepoProvider>
          </PlacesRepoProvider>
        </KvRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  useUiStore.setState({
    themeOverride: null,
    localeOverride: null,
    onboardingComplete: true,
  });
  resetProMock();
});

describe("snapshots — main screens", () => {
  it("Timeline with a single seeded place", () => {
    const fixture = makeFixture(true);
    const tree = render(
      <Wrap fixture={fixture}>
        <TimelineScreen />
      </Wrap>,
    ).toJSON();
    expect(stableSnapshot(tree)).toMatchSnapshot();
  });

  it("Stats (empty week)", () => {
    const fixture = makeFixture(true);
    const tree = render(
      <Wrap fixture={fixture}>
        <StatsScreen />
      </Wrap>,
    ).toJSON();
    expect(stableSnapshot(tree)).toMatchSnapshot();
  });

  it("Settings (free user, one place)", () => {
    const fixture = makeFixture(true);
    const tree = render(
      <Wrap fixture={fixture}>
        <SettingsScreen />
      </Wrap>,
    ).toJSON();
    expect(stableSnapshot(tree)).toMatchSnapshot();
  });

  it("Paywall (year plan selected)", () => {
    const fixture = makeFixture(false);
    const tree = render(
      <Wrap fixture={fixture}>
        <PaywallScreen onClose={() => {}} />
      </Wrap>,
    ).toJSON();
    expect(stableSnapshot(tree)).toMatchSnapshot();
  });

  it("EntryEditSheet (new entry)", () => {
    const fixture = makeFixture(true);
    const tree = render(
      <Wrap fixture={fixture}>
        <EntryEditSheet visible entryId={null} onClose={() => {}} />
      </Wrap>,
    ).toJSON();
    expect(stableSnapshot(tree)).toMatchSnapshot();
  });

  it("AddPlaceSheet (edit mode, pre-filled place)", () => {
    const fixture = makeFixture(true);
    const placeId = fixture.placesRepo.list()[0]!.id;
    const tree = render(
      <Wrap fixture={fixture}>
        <AddPlaceSheet visible placeId={placeId} onClose={() => {}} />
      </Wrap>,
    ).toJSON();
    expect(stableSnapshot(tree)).toMatchSnapshot();
  });
});
