import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Fab } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { useEntriesRange } from "@/features/entries/useEntriesRange";
import { useOngoingEntry } from "@/features/entries/useOngoingEntry";
import { useRefreshOnSheetClose } from "@/features/entries/useRefreshOnSheetClose";
import { useClosestPlace } from "@/features/places/useClosestPlace";
import { usePlaces } from "@/features/places/usePlaces";
import { rangeForMode, type RangeMode } from "@/lib/range";
import { indexPlacesById, netMinutes } from "@/lib/entries";
import { usePro } from "@/features/billing/usePro";
import { useSheetStore } from "@/state/sheetStore";
import type { IconName } from "@/components";
import { DayNavHeader } from "@/screens/shared/DayNavHeader";
import { EntryRow } from "@/screens/shared/EntryRow";
import { NearbyPlacesBanner } from "./NearbyPlacesBanner";
import { NoEntriesEmptyState } from "./NoEntriesEmptyState";
import { NoPlacesEmptyState } from "./NoPlacesEmptyState";
import { RunningTimerCard } from "./RunningTimerCard";
import { TrackingBanner } from "./TrackingBanner";

export function TimelineScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<RangeMode>("day");
  const [offset, setOffset] = useState(0);

  const { startS, endS } = useMemo(() => rangeForMode(mode, offset), [mode, offset]);
  const entriesState = useEntriesRange(startS, endS);
  const ongoingState = useOngoingEntry();
  const placesState = usePlaces();
  const openSheet = useSheetStore((s) => s.openSheet);
  const { isPro } = usePro();

  const handleRefresh = useCallback(() => {
    entriesState.refresh();
    ongoingState.refresh();
  }, [entriesState, ongoingState]);
  useRefreshOnSheetClose(["entryEdit", "addPlace"], handleRefresh);

  const placesById = useMemo(() => indexPlacesById(placesState.places), [placesState.places]);

  const totalMin = useMemo(
    () => entriesState.entries.reduce((sum, e) => sum + netMinutes(e), 0),
    [entriesState.entries],
  );

  const ongoingPlace = ongoingState.entry ? placesById.get(ongoingState.entry.placeId) : null;
  // Only surface the running-timer card in Day view at offset 0 — "today".
  // Broader views aggregate; showing a live timer above a weekly/monthly
  // list would be visually confusing.
  const isToday = mode === "day" && offset === 0;
  const showRunning = isToday && ongoingState.entry != null && ongoingPlace != null;

  const handleOpenEntry = useCallback(
    (entryId: string) => {
      openSheet("entryEdit", { entryId });
    },
    [openSheet],
  );

  const handleAddManual = useCallback(() => {
    openSheet("entryEdit", { entryId: null });
  }, [openSheet]);

  // Quick-add pivot: if the user is inside (or within 2× radius of) a
  // saved place and nothing is tracking right now, the primary action
  // becomes "Start tracking at {place}" instead of manual-entry.
  const closest = useClosestPlace();
  const canQuickStart = !showRunning && closest != null && (closest.inside || closest.near);
  const handleQuickStart = useCallback(() => {
    if (!closest) return;
    ongoingState.start({ placeId: closest.place.id, source: "manual" });
    handleRefresh();
  }, [closest, ongoingState, handleRefresh]);

  const handleAddPlace = useCallback(() => {
    openSheet("addPlace", { placeId: null });
  }, [openSheet]);

  const handleStopOngoing = useCallback(() => {
    ongoingState.stop();
    handleRefresh();
  }, [ongoingState, handleRefresh]);

  // Memoized so the RunningTimerCard's 1Hz tick doesn't rebuild rows; EntryRow
  // is already React.memo-wrapped but skipping the .map() avoids the JSX cost.
  const entryRows = useMemo(
    () =>
      entriesState.entries.map((entry, index) => {
        const place = placesById.get(entry.placeId);
        if (!place) return null;
        return (
          <EntryRow
            key={entry.id}
            entryId={entry.id}
            placeName={place.name}
            placeIcon={place.icon as IconName}
            placeColor={place.color}
            source={entry.source}
            startedAt={entry.startedAt}
            endedAt={entry.endedAt}
            netMinutes={netMinutes(entry)}
            onPress={handleOpenEntry}
            last={index === entriesState.entries.length - 1}
            testID={`entry-row-${entry.id}`}
          />
        );
      }),
    [entriesState.entries, placesById, handleOpenEntry],
  );

  const noPlaces = placesState.places.length === 0;
  const noEntries = entriesState.entries.length === 0 && !showRunning;

  return (
    <View style={{ flex: 1, backgroundColor: t.color("color.bg") }}>
      {/* Header sits under the safe-area top — we let it own the inset. */}
      <View style={{ paddingTop: insets.top }}>
        <DayNavHeader
          mode={mode}
          offset={offset}
          totalMin={totalMin}
          isPro={isPro}
          onChangeMode={setMode}
          onChangeOffset={setOffset}
          testID="day-nav-header"
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[5],
          // Leave room for the small FAB so the last row isn't obscured. No FAB
          // in the zero-places state, but leaving the padding keeps the empty
          // state visually centered.
          paddingBottom: t.space[10] + t.space[5],
        }}
      >
        {/* Positional readout — "Inside Home" / "~40m from Home" — renders
            null when the user is far from every saved place. Lives above the
            permission banner so permission issues take precedence. */}
        <View style={{ marginBottom: t.space[2], alignItems: "flex-start" }}>
          <NearbyPlacesBanner />
        </View>

        {/* Permission status banner — renders null when auto-tracking is healthy. */}
        <View style={{ marginBottom: t.space[3] }}>
          <TrackingBanner />
        </View>

        {showRunning && ongoingState.entry && ongoingPlace ? (
          <View style={{ marginBottom: t.space[5] }}>
            <RunningTimerCard
              placeName={ongoingPlace.name}
              startedAt={ongoingState.entry.startedAt}
              onStop={handleStopOngoing}
              testID="running-timer-card"
            />
          </View>
        ) : null}

        {!noPlaces && canQuickStart && closest ? (
          <View style={{ marginBottom: t.space[4] }}>
            <Button
              variant="primary"
              size="md"
              full
              onPress={handleQuickStart}
              testID="timeline-start-here"
              accessibilityHint={i18n.t("timeline.fab.startHere.hint")}
            >
              {i18n.t("timeline.fab.startHere", { name: closest.place.name })}
            </Button>
          </View>
        ) : null}

        {noPlaces ? (
          <NoPlacesEmptyState onAddPlace={handleAddPlace} />
        ) : noEntries ? (
          <NoEntriesEmptyState onAddAnotherPlace={handleAddPlace} />
        ) : (
          entryRows
        )}
      </ScrollView>

      {!noPlaces && !showRunning ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: t.space[5],
            bottom: t.space[5] + insets.bottom,
          }}
        >
          <Fab
            icon="plus"
            onPress={handleAddManual}
            accessibilityLabel={i18n.t("timeline.fab.addEntry")}
            accessibilityHint={i18n.t("timeline.fab.addEntry.hint")}
            testID="timeline-fab"
          />
        </View>
      ) : null}
    </View>
  );
}
