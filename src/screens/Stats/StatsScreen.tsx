import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { Card, Icon, IconBadge } from "@/components";
import { usePro } from "@/features/billing/usePro";
import { useWeekStats } from "@/features/entries/useWeekStats";
import { useRefreshOnSheetClose } from "@/features/entries/useRefreshOnSheetClose";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import { i18n } from "@/lib/i18n";
import { localeForDateApis } from "@/lib/time";
import type { Place } from "@/db/schema";
import { WeekBarChart } from "./WeekBarChart";
import { Ledger } from "./Ledger";

/**
 * Stats tab. Four stacked sections inside a vertical scroll view:
 * 1. Heading ("This week" + week-range navigator with < > chevrons).
 * 2. Week bar chart card (via `WeekBarChart`) with color-dot legend.
 * 3. Pro-upsell card (only when `!isPro`) that opens the paywall sheet.
 * 4. Spreadsheet `Ledger` listing every entry in the current week.
 *
 * Week navigation: forward chevron clamps at offset 0 (this week). Backward
 * chevron fires the paywall when the user is on the free plan — past-week
 * stats are a Pro feature.
 */
export function StatsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [weekOffset, setWeekOffset] = useState(0);
  const stats = useWeekStats(weekOffset);
  const placesState = usePlaces();
  const { isPro } = usePro();
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

  const handlePrevWeek = useCallback(() => {
    if (!isPro) {
      handleOpenPaywall();
      return;
    }
    setWeekOffset((o) => o - 1);
  }, [isPro, handleOpenPaywall]);

  const handleNextWeek = useCallback(() => {
    setWeekOffset((o) => Math.min(0, o + 1));
  }, []);

  const nextDisabled = weekOffset >= 0;

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
          accessibilityRole="header"
          style={{
            fontSize: t.type.size.xl,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            letterSpacing: -0.4,
          }}
        >
          {i18n.t("stats.title")}
        </Text>
      </View>

      {/* Week navigator — < [range] > */}
      <View
        style={{
          paddingHorizontal: t.space[5],
          paddingBottom: t.space[3],
          flexDirection: "row",
          alignItems: "center",
          gap: t.space[2],
        }}
        testID="stats-week-nav"
      >
        <Pressable
          onPress={handlePrevWeek}
          testID="stats-week-prev"
          accessibilityRole="button"
          accessibilityLabel={i18n.t("stats.week.prev")}
          hitSlop={8}
          style={{
            minWidth: t.minTouchTarget,
            minHeight: t.minTouchTarget,
            width: t.minTouchTarget,
            height: t.minTouchTarget,
            borderRadius: t.radius.pill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="chevron-left" size={18} color={t.color("color.fg2")} />
        </Pressable>
        <Text
          testID="stats-week-range"
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
            fontVariant: ["tabular-nums"],
          }}
        >
          {rangeLabel}
        </Text>
        <Pressable
          onPress={handleNextWeek}
          testID="stats-week-next"
          accessibilityRole="button"
          accessibilityLabel={i18n.t("stats.week.next")}
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          hitSlop={8}
          style={{
            minWidth: t.minTouchTarget,
            minHeight: t.minTouchTarget,
            width: t.minTouchTarget,
            height: t.minTouchTarget,
            borderRadius: t.radius.pill,
            alignItems: "center",
            justifyContent: "center",
            opacity: nextDisabled ? 0.3 : 1,
          }}
        >
          <Icon name="chevron-right" size={18} color={t.color("color.fg2")} />
        </Pressable>
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

/** "Apr 13 — Apr 19" for a Monday-start week. Honors the active i18n locale. */
function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const locale = localeForDateApis();
  const startLabel = weekStart.toLocaleDateString(locale, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${startLabel} — ${endLabel}`;
}
