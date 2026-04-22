import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { Card, Fab, Icon, IconBadge, WidgetBoundary } from "@/components";
import { usePro } from "@/features/billing/usePro";
import { openPaywall } from "@/features/billing/openPaywall";
import { useEntriesRange } from "@/features/entries/useEntriesRange";
import { useRefreshOnSheetClose } from "@/features/entries/useRefreshOnSheetClose";
import { useWeekStats } from "@/features/entries/useWeekStats";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import { i18n } from "@/lib/i18n";
import type { Entry, Place } from "@/db/schema";
import type { IconName } from "@/components";
import { EntryRow } from "@/screens/shared/EntryRow";
import { DayNavHeader, FREE_HISTORY_DAYS } from "@/screens/shared/DayNavHeader";
import { rangeForMode, type RangeMode } from "@/lib/range";
import { indexPlacesById, netMinutes } from "@/lib/entries";
import { WeekBarChart } from "./WeekBarChart";
import { SummaryCard } from "./SummaryCard";
import { aggregate } from "./statsHelpers";

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

  const placesById = useMemo(() => indexPlacesById(placesState.places), [placesState.places]);

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
    openPaywall({ source: "history" });
  }, []);

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
        <SummaryCard
          totalMin={totalMin}
          perPlace={perPlace}
          mode={mode}
          viewedDate={new Date(startS * 1000)}
        />

        {mode === "week" ? (
          <View style={{ paddingHorizontal: t.space[5], paddingVertical: t.space[2] }}>
            <WidgetBoundary scope="stats.weekBarChart">
              <WeekBarChart
                byDay={weekStats.byDay}
                byPlace={weekStats.byPlace}
                testID="week-bar-chart"
              />
            </WidgetBoundary>
          </View>
        ) : null}

        {!isPro ? (
          <View style={{ paddingHorizontal: t.space[5], paddingVertical: t.space[2] }}>
            <Card padding={4} onPress={handleOpenPaywall} testID="stats-pro-upsell">
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
        />
      </ScrollView>

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
          onPress={handleAddEntry}
          accessibilityLabel={i18n.t("stats.entries.add")}
          testID="stats-add-entry"
        />
      </View>
    </View>
  );
}

function EntriesSection({
  entries,
  placesById,
  onOpenEntry,
}: {
  entries: Entry[];
  placesById: Map<string, Place>;
  onOpenEntry: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: t.space[5], paddingTop: t.space[3] }}>
      <View style={{ paddingBottom: t.space[2] }}>
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
              source={entry.source}
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

// Re-export for the places tab range picker & anyone else that wants the
// same history gate constant.
export { FREE_HISTORY_DAYS };
