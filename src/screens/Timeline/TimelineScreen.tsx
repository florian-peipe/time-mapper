import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Rings } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { useEntries } from "@/features/entries/useEntries";
import { useOngoingEntry } from "@/features/entries/useOngoingEntry";
import { useRefreshOnSheetClose } from "@/features/entries/useRefreshOnSheetClose";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import type { Entry, Place } from "@/db/schema";
import type { IconName, SourceKind } from "@/components";
import { DayNavHeader } from "./DayNavHeader";
import { EntryRow } from "./EntryRow";
import { RunningTimerCard } from "./RunningTimerCard";

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
  const [dayOffset, setDayOffset] = useState(0);

  const entriesState = useEntries(dayOffset);
  const ongoingState = useOngoingEntry();
  const placesState = usePlaces();
  const openSheet = useSheetStore((s) => s.openSheet);

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
  const showRunning = dayOffset === 0 && ongoingState.entry != null && ongoingPlace != null;

  const handleOpenEntry = useCallback(
    (entryId: string) => {
      openSheet("entryEdit", { entryId });
    },
    [openSheet],
  );

  const handleAddManual = useCallback(() => {
    openSheet("entryEdit", { entryId: null });
  }, [openSheet]);

  const handleStopOngoing = useCallback(() => {
    ongoingState.stop();
    handleRefresh();
  }, [ongoingState, handleRefresh]);

  return (
    <View style={{ flex: 1, backgroundColor: t.color("color.bg") }}>
      {/* Header sits under the safe-area top — we let it own the inset. */}
      <View style={{ paddingTop: insets.top }}>
        <DayNavHeader dayOffset={dayOffset} totalMin={totalMin} onChangeDay={setDayOffset} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[5],
          // Leave room for the FAB so the last row isn't obscured.
          paddingBottom: t.space[10] + t.space[5],
        }}
      >
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

        {entriesState.entries.length === 0 && !showRunning ? (
          <EmptyState />
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
              />
            );
          })
        )}
      </ScrollView>

      {/* FAB — accent circle, bottom-right, 20/20 from the safe-area edge. */}
      <Pressable
        onPress={handleAddManual}
        accessibilityRole="button"
        accessibilityLabel="Add entry"
        testID="timeline-fab"
        style={{
          position: "absolute",
          right: t.space[5],
          bottom: t.space[5] + insets.bottom,
          width: t.space[14], // 56 — design-system FAB size (space[14] = 56)
          height: t.space[14],
          borderRadius: t.radius.pill,
          backgroundColor: t.color("color.accent"),
          alignItems: "center",
          justifyContent: "center",
          // FAB accent drop-shadow (design-system Screens.jsx boxShadow uses
          // rgba(255,106,61,0.4)). We tint the shadow with the accent color
          // for the same effect while keeping the color tokenized.
          shadowColor: t.color("color.accent"),
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Icon name="plus" size={26} color={t.color("color.accent.contrast")} />
      </Pressable>
    </View>
  );
}

function EmptyState() {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: t.space[10] + t.space[5], // 60 matches Screens.jsx
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
      <Text
        style={{
          fontSize: t.type.size.body,
          color: t.color("color.fg3"),
          fontFamily: t.type.family.sans,
          textAlign: "center",
          marginTop: t.space[8],
        }}
      >
        {i18n.t("timeline.empty.title")}
      </Text>
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
