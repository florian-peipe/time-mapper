// Batched smoke test for the ~20 presentational primitives extracted by the
// decomposition pass. Each renders once with minimal valid props + a shared
// provider wrap; we just assert `toJSON()` produced a tree. Catches regressions
// that DO fail at the unit layer: prop-type drift, missing imports, theme-
// token renames, accidental default-export changes.
//
// Not a replacement for direct behavioral tests — the parent screen tests
// (SettingsScreen, TimelineScreen, StatsScreen, AddPlaceSheet, Places) still
// own integration coverage. Dedicated Tier-1 tests cover the nine components
// with non-trivial branches.
import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { createTestDb } from "@/db/testClient";
import { makePlace } from "@/features/places/testFixtures";

// AddPlace
import { AppearanceCard } from "@/screens/AddPlace/AppearanceCard";
import { AddressPreviewCard } from "@/screens/AddPlace/AddressPreviewCard";
import { BufferSliderRow } from "@/screens/AddPlace/BufferSliderRow";
import { BuffersCard } from "@/screens/AddPlace/BuffersCard";
import { ColorSwatch } from "@/screens/AddPlace/ColorSwatch";
import { GoalSliderRow } from "@/screens/AddPlace/GoalSliderRow";
import { IconTile } from "@/screens/AddPlace/IconTile";
// EntryEdit
import { NoteSection } from "@/screens/EntryEdit/NoteSection";
// Places
import { PlacesListView } from "@/screens/Places/PlacesListView";
import { PlacesEmptyState } from "@/screens/Places/PlacesEmptyState";
// Settings
import { HourRow } from "@/screens/Settings/HourRow";
import { ProChip } from "@/screens/Settings/ProChip";
import { SettingsAppearanceSection } from "@/screens/Settings/SettingsAppearanceSection";
import { SettingsDataSection } from "@/screens/Settings/SettingsDataSection";
import { SettingsSubscriptionSection } from "@/screens/Settings/SettingsSubscriptionSection";
import { SettingsTrackingSection } from "@/screens/Settings/SettingsTrackingSection";
// Stats
import { PlaceBar } from "@/screens/Stats/PlaceBar";
import { SummaryCard } from "@/screens/Stats/SummaryCard";
// Timeline
import { NoPlacesEmptyState } from "@/screens/Timeline/NoPlacesEmptyState";
import { NoEntriesEmptyState } from "@/screens/Timeline/NoEntriesEmptyState";

function wrap(ui: React.ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

function assertRenders(tree: unknown) {
  expect(tree).not.toBeNull();
  expect(tree).toBeDefined();
}

const NO_OP = () => undefined;

describe("primitives-smoke — AddPlace", () => {
  it("AppearanceCard", () => {
    const { toJSON } = render(
      wrap(
        <AppearanceCard
          colorIdx={0}
          onChangeColorIdx={NO_OP}
          iconIdx={0}
          onChangeIconIdx={NO_OP}
          chosenColor="#FF6A3D"
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("AddressPreviewCard", () => {
    const { toJSON } = render(
      wrap(
        <AddressPreviewCard
          selected={{
            description: "Kinkelstr. 3, 50733 Köln",
            latitude: 50.9613,
            longitude: 6.9585,
          }}
          name="Home"
          onChangeName={NO_OP}
          radius={100}
          chosenColor="#FF6A3D"
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("BufferSliderRow", () => {
    const { toJSON } = render(
      wrap(
        <BufferSliderRow
          label="Entry"
          minutes={5}
          minValue={1}
          maxValue={15}
          onChange={NO_OP}
          visible
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("BuffersCard", () => {
    const { toJSON } = render(
      wrap(
        <BuffersCard
          entryBufferMin={5}
          onChangeEntryBufferMin={NO_OP}
          exitBufferMin={3}
          onChangeExitBufferMin={NO_OP}
          visible
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("ColorSwatch (selected)", () => {
    const { toJSON } = render(wrap(<ColorSwatch color="#FF6A3D" selected onPress={NO_OP} />));
    assertRenders(toJSON());
  });

  it("ColorSwatch (unselected)", () => {
    const { toJSON } = render(
      wrap(<ColorSwatch color="#FF6A3D" selected={false} onPress={NO_OP} />),
    );
    assertRenders(toJSON());
  });

  it("GoalSliderRow (daily variant with days picker)", () => {
    const { toJSON } = render(
      wrap(
        <GoalSliderRow
          label="Daily"
          enabled
          hours={2}
          minValue={1}
          maxValue={8}
          onToggle={NO_OP}
          onChangeHours={NO_OP}
          daysValue={[1, 2, 3, 4, 5]}
          onDaysChange={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("GoalSliderRow (weekly variant, no days picker)", () => {
    const { toJSON } = render(
      wrap(
        <GoalSliderRow
          label="Weekly"
          enabled={false}
          hours={10}
          minValue={5}
          maxValue={60}
          onToggle={NO_OP}
          onChangeHours={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("IconTile (selected)", () => {
    const { toJSON } = render(
      wrap(<IconTile name="home" selected color="#FF6A3D" onPress={NO_OP} />),
    );
    assertRenders(toJSON());
  });
});

describe("primitives-smoke — EntryEdit", () => {
  it("NoteSection", () => {
    const { toJSON } = render(wrap(<NoteSection value="" onChangeText={NO_OP} />));
    assertRenders(toJSON());
  });
});

describe("primitives-smoke — Places", () => {
  it("PlacesListView (populated)", () => {
    const places = [makePlace("a", { name: "Home" }), makePlace("b", { name: "Office" })];
    const { toJSON } = render(wrap(<PlacesListView places={places} onPressPlace={NO_OP} />));
    assertRenders(toJSON());
  });

  it("PlacesEmptyState", () => {
    const { toJSON } = render(wrap(<PlacesEmptyState onAdd={NO_OP} />));
    assertRenders(toJSON());
  });
});

describe("primitives-smoke — Settings", () => {
  it("HourRow (enabled)", () => {
    const { toJSON } = render(wrap(<HourRow label="Start" hour={22} onChange={NO_OP} />));
    assertRenders(toJSON());
  });

  it("HourRow (disabled)", () => {
    const { toJSON } = render(wrap(<HourRow label="End" hour={7} onChange={NO_OP} disabled />));
    assertRenders(toJSON());
  });

  it("ProChip", () => {
    const { toJSON } = render(wrap(<ProChip />));
    assertRenders(toJSON());
  });

  it("SettingsAppearanceSection", () => {
    const { toJSON } = render(
      wrap(
        <SettingsAppearanceSection
          themeOverride={null}
          localeOverride={null}
          onCycleTheme={NO_OP}
          onCycleLanguage={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("SettingsDataSection", () => {
    const db = createTestDb();
    const placesRepo = new PlacesRepo(db);
    const entriesRepo = new EntriesRepo(db);
    const { toJSON } = render(
      wrap(
        <SettingsDataSection
          isPro={false}
          ProChip={ProChip}
          placesRepo={placesRepo}
          entriesRepo={entriesRepo}
          retentionLabel="Forever"
          telemetryEnabled={false}
          onExport={NO_OP}
          onExportBackup={NO_OP}
          onCycleRetention={NO_OP}
          onToggleTelemetry={NO_OP}
          onShowOnboarding={NO_OP}
          onResetAllData={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("SettingsSubscriptionSection (free plan)", () => {
    const { toJSON } = render(
      wrap(
        <SettingsSubscriptionSection
          isPro={false}
          restoreState="idle"
          onManageSubscription={NO_OP}
          onRestore={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("SettingsSubscriptionSection (pro plan)", () => {
    const { toJSON } = render(
      wrap(
        <SettingsSubscriptionSection
          isPro
          restoreState="idle"
          onManageSubscription={NO_OP}
          onRestore={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("SettingsTrackingSection (granted)", () => {
    const { toJSON } = render(
      wrap(
        <SettingsTrackingSection
          locationStatus="granted"
          notificationsDenied={false}
          bufferDetail="5 / 3 min"
          onOpenLocationSettings={NO_OP}
          onOpenNotificationsSheet={NO_OP}
          onOpenBuffersSheet={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("SettingsTrackingSection (denied)", () => {
    const { toJSON } = render(
      wrap(
        <SettingsTrackingSection
          locationStatus="denied"
          notificationsDenied
          bufferDetail="5 / 3 min"
          onOpenLocationSettings={NO_OP}
          onOpenNotificationsSheet={NO_OP}
          onOpenBuffersSheet={NO_OP}
        />,
      ),
    );
    assertRenders(toJSON());
  });
});

describe("primitives-smoke — Stats", () => {
  it("PlaceBar (no goal)", () => {
    const { toJSON } = render(
      wrap(
        <PlaceBar
          place={makePlace("a", { name: "Home" })}
          minutes={90}
          max={120}
          mode="day"
          viewedDate={new Date(2026, 3, 15)}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("PlaceBar (with daily goal, crossed)", () => {
    const { toJSON } = render(
      wrap(
        <PlaceBar
          place={makePlace("a", { name: "Home", dailyGoalMinutes: 60 })}
          minutes={90}
          max={120}
          mode="day"
          viewedDate={new Date(2026, 3, 15)}
        />,
      ),
    );
    assertRenders(toJSON());
  });

  it("SummaryCard", () => {
    const { toJSON } = render(
      wrap(
        <SummaryCard
          totalMin={120}
          perPlace={[{ place: makePlace("a", { name: "Home" }), minutes: 90 }]}
          mode="week"
          viewedDate={new Date(2026, 3, 15)}
        />,
      ),
    );
    assertRenders(toJSON());
  });
});

describe("primitives-smoke — Timeline", () => {
  it("NoPlacesEmptyState", () => {
    const { toJSON } = render(wrap(<NoPlacesEmptyState onAddPlace={NO_OP} />));
    assertRenders(toJSON());
  });

  it("NoEntriesEmptyState", () => {
    const { toJSON } = render(wrap(<NoEntriesEmptyState onAddAnotherPlace={NO_OP} />));
    assertRenders(toJSON());
  });
});
