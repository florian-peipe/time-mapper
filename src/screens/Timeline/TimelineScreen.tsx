import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, Rings } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { useEntriesRange } from "@/features/entries/useEntriesRange";
import { useOngoingEntry } from "@/features/entries/useOngoingEntry";
import { useRefreshOnSheetClose } from "@/features/entries/useRefreshOnSheetClose";
import { useClosestPlace } from "@/features/places/useClosestPlace";
import { usePlaces } from "@/features/places/usePlaces";
import { rangeForMode } from "@/screens/Stats/range";
import { usePro } from "@/features/billing/usePro";
import { useSheetStore } from "@/state/sheetStore";
import type { Entry, Place } from "@/db/schema";
import type { IconName, SourceKind } from "@/components";
import { DayNavHeader, type RangeMode } from "./DayNavHeader";
import { EntryRow } from "./EntryRow";
import { NearbyPlacesBanner } from "./NearbyPlacesBanner";
import { RunningTimerCard } from "./RunningTimerCard";
import { TrackingBanner } from "./TrackingBanner";

/**
 * Home tab — today by default, with chevron navigation back through days.
 *
 * Data wiring:
 * - `useEntries(dayOffset)` — the day's entries.
 * - `useOngoingEntry()` — the single currently-tracking entry, shown only on
 *   `dayOffset === 0` (you can't be tracking "yesterday").
 * - `usePlaces()` — metadata to decorate each entry row (name/icon/color).
 * - `useRefreshOnSheetClose(["entryEdit"], ...)` — when the user dismisses the
 *   edit sheet, re-fetch so any create/update/delete lands.
 *
 * Pure composition: no inline styles, no hex literals. All visual rhythm comes
 * through the shared primitives and `useTheme()` tokens.
 */
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

  const placesById = useMemo(() => indexPlaces(placesState.places), [placesState.places]);

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

        {noPlaces ? (
          <NoPlacesEmptyState onAddPlace={handleAddPlace} />
        ) : noEntries ? (
          <NoEntriesEmptyState onAddAnotherPlace={handleAddPlace} />
        ) : (
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
                source={entry.source as SourceKind}
                startedAt={entry.startedAt}
                endedAt={entry.endedAt}
                netMinutes={netMinutes(entry)}
                onPress={handleOpenEntry}
                last={index === entriesState.entries.length - 1}
                testID={`entry-row-${entry.id}`}
              />
            );
          })
        )}
      </ScrollView>

      {/*
        Quick-add FAB — pivots based on proximity:
          - inside / near a saved place (and nothing tracking) → wide
            "Start tracking at {place}" primary button, one-tap opens an
            entry. The usual "auto" path handles most tracking; this is
            the escape hatch when the geofence hasn't fired yet.
          - no nearby place → small manual-entry icon fallback.
          - ongoing entry → hide (RunningTimerCard owns stop).
          - no places at all → hide (hero CTA on the empty state).
      */}
      {!noPlaces && canQuickStart && closest ? (
        <Pressable
          onPress={handleQuickStart}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("timeline.fab.startHere", { name: closest.place.name })}
          accessibilityHint={i18n.t("timeline.fab.startHere.hint")}
          hitSlop={t.space[3]}
          testID="timeline-fab-start-here"
          style={{
            position: "absolute",
            right: t.space[5],
            left: t.space[5],
            bottom: t.space[5] + insets.bottom,
            height: t.space[10] + t.space[2], // 48pt — primary action touch target
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.accent"),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: t.space[2],
            shadowColor: t.color("color.fg"),
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <Icon name="clock" size={18} color={t.color("color.accent.contrast")} />
          <Text
            style={{
              fontSize: t.type.size.body,
              fontWeight: t.type.weight.semibold,
              color: t.color("color.accent.contrast"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("timeline.fab.startHere", { name: closest.place.name })}
          </Text>
        </Pressable>
      ) : !noPlaces && !showRunning ? (
        <Pressable
          onPress={handleAddManual}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("timeline.fab.addEntry")}
          accessibilityHint={i18n.t("timeline.fab.addEntry.hint")}
          hitSlop={t.space[3]}
          testID="timeline-fab"
          style={{
            position: "absolute",
            right: t.space[5],
            bottom: t.space[5] + insets.bottom,
            // design-source: de-emphasized small FAB — 40px circle (space[10]).
            width: t.space[10],
            height: t.space[10],
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.surface"),
            borderWidth: 1,
            borderColor: t.color("color.border.strong"),
            alignItems: "center",
            justifyContent: "center",
            shadowColor: t.color("color.fg"),
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Icon name="plus" size={20} color={t.color("color.fg2")} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Hero empty state for when the user has NO places yet. This is the
 * "place-first" primary CTA — adding a place is the only thing to do,
 * and manual entry is hidden entirely (no FAB) so it doesn't compete.
 */
function NoPlacesEmptyState({ onAddPlace }: { onAddPlace: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: t.space[10] + t.space[5],
        position: "relative",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <Rings size={260} opacity={0.07} />
      </View>
      <View style={{ marginTop: t.space[10], alignItems: "center", gap: t.space[3] }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: t.type.size.l,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            letterSpacing: -0.3,
          }}
        >
          {i18n.t("timeline.emptyNoPlaces.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.body,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            maxWidth: 280,
            lineHeight: t.type.size.body * t.type.lineHeight.body,
          }}
        >
          {i18n.t("timeline.emptyNoPlaces.body")}
        </Text>
        <View style={{ marginTop: t.space[3] }}>
          <Button variant="primary" size="md" onPress={onAddPlace} testID="timeline-add-place-cta">
            {i18n.t("timeline.emptyNoPlaces.cta")}
          </Button>
        </View>
      </View>
    </View>
  );
}

/**
 * Empty state for when the user HAS places but no entries today (and
 * nothing is currently tracking). Copy reassures them tracking is
 * armed, and offers a tertiary "Add another place" nudge so the path
 * to growing their place list stays visible.
 */
function NoEntriesEmptyState({ onAddAnotherPlace }: { onAddAnotherPlace: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: t.space[10] + t.space[5],
        position: "relative",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <Rings size={240} opacity={0.07} />
      </View>
      <View style={{ marginTop: t.space[10], alignItems: "center", gap: t.space[2] }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: t.type.size.m,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
          }}
        >
          {i18n.t("timeline.emptyTrackedReady.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.body,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            maxWidth: 300,
            lineHeight: t.type.size.body * t.type.lineHeight.body,
          }}
        >
          {i18n.t("timeline.emptyTrackedReady.body")}
        </Text>
        <View style={{ marginTop: t.space[2] }}>
          <Button
            variant="tertiary"
            size="sm"
            onPress={onAddAnotherPlace}
            testID="timeline-add-another-place"
          >
            {i18n.t("timeline.emptyTrackedReady.cta")}
          </Button>
        </View>
      </View>
    </View>
  );
}

/**
 * Net minutes (gross − pause) of an entry, clamped to 0. Ongoing entries
 * contribute 0 to the day total — they render through RunningTimerCard,
 * not the sum.
 */
function netMinutes(entry: Entry): number {
  if (entry.endedAt == null) return 0;
  const seconds = entry.endedAt - entry.startedAt - (entry.pauseS ?? 0);
  if (seconds <= 0) return 0;
  return Math.round(seconds / 60);
}

function indexPlaces(places: Place[]): Map<string, Place> {
  const map = new Map<string, Place>();
  for (const p of places) map.set(p.id, p);
  return map;
}
