import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { Card, Icon, IconBadge } from "@/components";
import { usePro } from "@/features/billing/usePro";
import { useEntriesRange } from "@/features/entries/useEntriesRange";
import { useRefreshOnSheetClose } from "@/features/entries/useRefreshOnSheetClose";
import { useWeekStats } from "@/features/entries/useWeekStats";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import { i18n } from "@/lib/i18n";
import type { Entry, Place } from "@/db/schema";
import type { IconName, SourceKind } from "@/components";
import { EntryRow } from "@/screens/Timeline/EntryRow";
import { DayNavHeader, FREE_HISTORY_DAYS, type RangeMode } from "@/screens/Timeline/DayNavHeader";
import { rangeForMode } from "./range";
import { WeekBarChart } from "./WeekBarChart";

/**
 * Stats tab — aggregated view over a cyclable time window (Day / Week /
 * Month / Year). Tapping the period label in the header cycles modes;
 * chevrons step the offset inside the current mode. Matches the Timeline
 * header UX so the two tabs behave consistently.
 *
 * Layout:
 * 1. DayNavHeader (same component Timeline uses).
 * 2. Summary card — total time + per-place breakdown as horizontal bars.
 *    Works in every mode; for an empty window it says "no entries yet".
 * 3. WeekBarChart — only when `mode === "week"`. Seven bars mapped to
 *    weekdays; collapsing this to day/month/year would lose the point.
 * 4. Pro-upsell card (free users only) — opens the paywall.
 * 5. Entry list — the same EntryRow primitive Timeline renders,
 *    ordered by `startedAt DESC`. Bottom "+ Add entry" button.
 */
export function StatsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<RangeMode>("week");
  const [offset, setOffset] = useState(0);

  const { startS, endS } = useMemo(() => rangeForMode(mode, offset), [mode, offset]);
  const range = useEntriesRange(startS, endS);
  const placesState = usePlaces();
  const { isPro } = usePro();
  const openSheet = useSheetStore((s) => s.openSheet);

  // The weekly bar chart still needs day buckets, which `useWeekStats`
  // already produces — pass the week-aligned offset only when we're
  // actually rendering the chart.
  const weekOffsetForChart = mode === "week" ? offset : 0;
  const weekStats = useWeekStats(weekOffsetForChart);

  useRefreshOnSheetClose(["entryEdit", "addPlace"], range.refresh);

  const placesById = useMemo(() => indexPlaces(placesState.places), [placesState.places]);

  const { totalMin, perPlace } = useMemo(
    () => aggregate(range.entries, placesById),
    [range.entries, placesById],
  );

  const handleOpenEntry = useCallback(
    (entryId: string) => {
      openSheet("entryEdit", { entryId });
    },
    [openSheet],
  );

  const handleAddEntry = useCallback(() => {
    openSheet("entryEdit", { entryId: null });
  }, [openSheet]);

  const handleOpenPaywall = useCallback(() => {
    openSheet("paywall", { source: "history" });
  }, [openSheet]);

  return (
    <View style={{ flex: 1, backgroundColor: t.color("color.bg") }}>
      <View style={{ paddingTop: insets.top }}>
        <DayNavHeader
          mode={mode}
          offset={offset}
          totalMin={totalMin}
          isPro={isPro}
          onChangeMode={setMode}
          onChangeOffset={setOffset}
          testID="stats-nav"
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + t.space[8],
        }}
      >
        <SummaryCard totalMin={totalMin} perPlace={perPlace} />

        {mode === "week" ? (
          <View style={{ paddingHorizontal: t.space[5], paddingVertical: t.space[2] }}>
            <WeekBarChart
              byDay={weekStats.byDay}
              byPlace={weekStats.byPlace}
              testID="week-bar-chart"
            />
          </View>
        ) : null}

        {!isPro ? (
          <View style={{ paddingHorizontal: t.space[5], paddingVertical: t.space[2] }}>
            <Card variant="tile" padding={4} onPress={handleOpenPaywall} testID="stats-pro-upsell">
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.space[3] }}>
                <IconBadge
                  icon="lock"
                  size={40}
                  bg={t.color("color.accent.soft")}
                  color={t.color("color.accent")}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: t.type.size.s,
                      fontWeight: t.type.weight.semibold,
                      color: t.color("color.fg"),
                      fontFamily: t.type.family.sans,
                    }}
                  >
                    {i18n.t("stats.upsell.title")}
                  </Text>
                  <Text
                    style={{
                      fontSize: t.type.size.xs,
                      color: t.color("color.fg2"),
                      fontFamily: t.type.family.sans,
                      marginTop: 2,
                    }}
                  >
                    {i18n.t("stats.upsell.body")}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={t.color("color.fg3")} />
              </View>
            </Card>
          </View>
        ) : null}

        <EntriesSection
          entries={range.entries}
          placesById={placesById}
          onOpenEntry={handleOpenEntry}
          onAddEntry={handleAddEntry}
        />
      </ScrollView>
    </View>
  );
}

/**
 * Total tracked minutes + ordered per-place totals for the current window.
 * Ongoing entries (null endedAt) contribute 0 — they still render in the
 * list below via EntryRow, they just don't skew the aggregate.
 */
function aggregate(
  entries: Entry[],
  placesById: Map<string, Place>,
): {
  totalMin: number;
  perPlace: { place: Place; minutes: number }[];
} {
  const totals = new Map<string, number>();
  let totalMin = 0;
  for (const e of entries) {
    if (e.endedAt == null) continue;
    const seconds = e.endedAt - e.startedAt - (e.pauseS ?? 0);
    if (seconds <= 0) continue;
    const mins = Math.round(seconds / 60);
    totalMin += mins;
    totals.set(e.placeId, (totals.get(e.placeId) ?? 0) + mins);
  }
  const perPlace: { place: Place; minutes: number }[] = [];
  for (const [id, minutes] of totals) {
    const place = placesById.get(id);
    if (!place) continue;
    perPlace.push({ place, minutes });
  }
  perPlace.sort((a, b) => b.minutes - a.minutes);
  return { totalMin, perPlace };
}

function SummaryCard({
  totalMin,
  perPlace,
}: {
  totalMin: number;
  perPlace: { place: Place; minutes: number }[];
}) {
  const t = useTheme();
  const max = Math.max(1, ...perPlace.map((p) => p.minutes));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  return (
    <View style={{ paddingHorizontal: t.space[5], paddingTop: t.space[2] }}>
      <Card variant="tile" padding={4}>
        <Text
          style={{
            fontSize: t.type.size.xs,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: t.space[1],
          }}
        >
          {i18n.t("stats.summary.label")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.display,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            letterSpacing: -0.6,
            fontVariant: ["tabular-nums"],
          }}
          testID="stats-summary-total"
        >
          {i18n.t("stats.summary.total", { hours, minutes })}
        </Text>

        {perPlace.length > 0 ? (
          <View style={{ marginTop: t.space[3], gap: t.space[2] }}>
            {perPlace.map(({ place, minutes: m }) => (
              <PlaceBar key={place.id} place={place} minutes={m} max={max} />
            ))}
          </View>
        ) : (
          <Text
            style={{
              marginTop: t.space[2],
              fontSize: t.type.size.s,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("stats.summary.empty")}
          </Text>
        )}
      </Card>
    </View>
  );
}

function PlaceBar({ place, minutes, max }: { place: Place; minutes: number; max: number }) {
  const t = useTheme();
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const label =
    h === 0 ? i18n.t("stats.summary.rowMinutes", { m }) : i18n.t("stats.summary.rowHM", { h, m });
  const pct = Math.max(4, Math.round((minutes / max) * 100));
  return (
    <View
      testID={`stats-place-bar-${place.id}`}
      style={{ flexDirection: "row", alignItems: "center", gap: t.space[2] }}
    >
      <Text
        numberOfLines={1}
        style={{
          width: 90,
          fontSize: t.type.size.s,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.medium,
        }}
      >
        {place.name}
      </Text>
      <View
        style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          backgroundColor: t.color("color.surface2"),
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: place.color,
          }}
        />
      </View>
      <Text
        style={{
          minWidth: 56,
          textAlign: "right",
          fontSize: t.type.size.s,
          color: t.color("color.fg2"),
          fontFamily: t.type.family.sans,
          fontVariant: ["tabular-nums"],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function EntriesSection({
  entries,
  placesById,
  onOpenEntry,
  onAddEntry,
}: {
  entries: Entry[];
  placesById: Map<string, Place>;
  onOpenEntry: (id: string) => void;
  onAddEntry: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: t.space[5], paddingTop: t.space[3] }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: t.space[2],
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {i18n.t("stats.entries.sectionTitle")}
        </Text>
        <Pressable
          onPress={onAddEntry}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("stats.entries.add")}
          testID="stats-add-entry"
          hitSlop={t.space[2]}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.space[1],
            paddingHorizontal: t.space[2] + 1,
            paddingVertical: t.space[1] + 2,
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.fg"),
          }}
        >
          <Icon name="plus" size={13} color={t.color("color.bg")} />
          <Text
            style={{
              fontSize: t.type.size.xs,
              fontWeight: t.type.weight.semibold,
              color: t.color("color.bg"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("stats.entries.add")}
          </Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Text
          style={{
            paddingVertical: t.space[6],
            textAlign: "center",
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
          }}
          testID="stats-entries-empty"
        >
          {i18n.t("stats.entries.empty")}
        </Text>
      ) : (
        entries.map((entry, idx) => {
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
              onPress={onOpenEntry}
              last={idx === entries.length - 1}
              testID={`stats-entry-row-${entry.id}`}
            />
          );
        })
      )}
    </View>
  );
}

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

// Re-export for the places tab range picker & anyone else that wants the
// same history gate constant.
export { FREE_HISTORY_DAYS };
