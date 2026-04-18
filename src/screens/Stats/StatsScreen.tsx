import React, { useCallback, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { Card, Icon, IconBadge } from "@/components";
import { useProMock } from "@/features/billing/useProMock";
import { useWeekStats } from "@/features/entries/useWeekStats";
import { useRefreshOnSheetClose } from "@/features/entries/useRefreshOnSheetClose";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import type { Place } from "@/db/schema";
import { WeekBarChart } from "./WeekBarChart";
import { Ledger } from "./Ledger";

/**
 * Stats tab. Three stacked sections inside a vertical scroll view:
 * 1. Heading ("This week" + date range).
 * 2. Week bar chart card (via `WeekBarChart`) with color-dot legend.
 * 3. Pro-upsell card (only when `!isPro`) that opens the paywall sheet.
 * 4. Spreadsheet `Ledger` listing every entry in the current week.
 *
 * Tapping the Pro upsell or a Ledger "Add row" button fires the shared
 * `sheetStore` open-sheet action. Data is read from `useWeekStats()`
 * (including the freshly exposed `entries` array) and `usePlaces()`.
 */
export function StatsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const stats = useWeekStats();
  const placesState = usePlaces();
  const { isPro } = useProMock();
  const openSheet = useSheetStore((s) => s.openSheet);

  const handleRefresh = useCallback(() => {
    stats.refresh();
  }, [stats]);
  useRefreshOnSheetClose(["entryEdit", "addPlace"], handleRefresh);

  const placesById = useMemo(() => indexPlaces(placesState.places), [placesState.places]);

  const rangeLabel = useMemo(() => formatWeekRange(stats.weekStart), [stats.weekStart]);

  const handleOpenPaywall = useCallback(() => {
    openSheet("paywall", { source: "history" });
  }, [openSheet]);

  const handleOpenEntry = useCallback(
    (entryId: string) => {
      openSheet("entryEdit", { entryId });
    },
    [openSheet],
  );

  const handleAddEntry = useCallback(() => {
    openSheet("entryEdit", { entryId: null });
  }, [openSheet]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color("color.bg") }}
      contentContainerStyle={{
        paddingTop: insets.top + t.space[3],
        paddingBottom: insets.bottom + t.space[8],
      }}
    >
      {/* Heading */}
      <View style={{ paddingHorizontal: t.space[5], paddingBottom: t.space[2] }}>
        <Text
          style={{
            fontSize: t.type.size.xl,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            letterSpacing: -0.4,
          }}
        >
          This week
        </Text>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            marginTop: 2,
          }}
        >
          {rangeLabel}
        </Text>
      </View>

      <View style={{ paddingHorizontal: t.space[5], paddingVertical: t.space[2] }}>
        <WeekBarChart byDay={stats.byDay} byPlace={stats.byPlace} testID="week-bar-chart" />
      </View>

      {!isPro ? (
        <View style={{ paddingHorizontal: t.space[5], paddingBottom: t.space[2] }}>
          <Card variant="tile" padding={4} onPress={handleOpenPaywall} testID="stats-pro-upsell">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: t.space[3],
              }}
            >
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
                  Past weeks with Pro
                </Text>
                <Text
                  style={{
                    fontSize: t.type.size.xs,
                    color: t.color("color.fg2"),
                    fontFamily: t.type.family.sans,
                    marginTop: 2,
                  }}
                >
                  Browse full history and export CSV.
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={t.color("color.fg3")} />
            </View>
          </Card>
        </View>
      ) : null}

      <Ledger
        entries={stats.entries}
        placesById={placesById}
        onOpenEntry={handleOpenEntry}
        onAddRow={handleAddEntry}
        testID="ledger"
      />
    </ScrollView>
  );
}

function indexPlaces(places: Place[]): Map<string, Place> {
  const map = new Map<string, Place>();
  for (const p of places) map.set(p.id, p);
  return map;
}

/** "Apr 13 — Apr 19" for a Monday-start week. */
function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const startLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel} — ${endLabel}`;
}
