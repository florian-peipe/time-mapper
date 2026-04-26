import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { localeForDateApis } from "@/lib/time";
import { openPaywall } from "@/features/billing/openPaywall";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

/** Sync with DayNavHeader.FREE_HISTORY_DAYS. */
const FREE_HISTORY_DAYS = 14;

const DAY_KEYS = [
  "dayPicker.short.mon",
  "dayPicker.short.tue",
  "dayPicker.short.wed",
  "dayPicker.short.thu",
  "dayPicker.short.fri",
  "dayPicker.short.sat",
  "dayPicker.short.sun",
] as const;

export type DatePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPickDate: (date: Date) => void;
  /** Start of the currently viewed period — the calendar opens to this month. */
  currentDate: Date;
  isPro: boolean;
};

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  const rawDow = firstDay.getDay(); // 0=Sun
  const mondayOffset = rawDow === 0 ? 6 : rawDow - 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export function DatePickerSheet({
  visible,
  onClose,
  onPickDate,
  currentDate,
  isPro,
}: DatePickerSheetProps) {
  const t = useTheme();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [displayYear, setDisplayYear] = useState(currentDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(currentDate.getMonth());

  useEffect(() => {
    if (visible) {
      setDisplayYear(currentDate.getFullYear());
      setDisplayMonth(currentDate.getMonth());
    }
  }, [visible, currentDate]);

  const grid = useMemo(() => buildGrid(displayYear, displayMonth), [displayYear, displayMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(displayYear, displayMonth, 1);
    return d.toLocaleDateString(localeForDateApis(), { month: "long", year: "numeric" });
  }, [displayYear, displayMonth]);

  const canGoNext = useMemo(() => {
    const now = new Date();
    return (
      displayYear < now.getFullYear() ||
      (displayYear === now.getFullYear() && displayMonth < now.getMonth())
    );
  }, [displayYear, displayMonth]);

  const prevMonth = useCallback(() => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear((y) => y - 1);
    } else {
      setDisplayMonth((m) => m - 1);
    }
  }, [displayMonth]);

  const nextMonth = useCallback(() => {
    if (!canGoNext) return;
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear((y) => y + 1);
    } else {
      setDisplayMonth((m) => m + 1);
    }
  }, [displayMonth, canGoNext]);

  const selectedDay = useMemo(() => {
    const cur = new Date(currentDate);
    cur.setHours(0, 0, 0, 0);
    if (cur.getFullYear() === displayYear && cur.getMonth() === displayMonth) {
      return cur.getDate();
    }
    return null;
  }, [currentDate, displayYear, displayMonth]);

  const handleDayPress = useCallback(
    (day: number) => {
      const date = new Date(displayYear, displayMonth, day);
      date.setHours(0, 0, 0, 0);
      const dayOffset = Math.round((date.getTime() - today.getTime()) / 86400000);
      if (dayOffset > 0) return;
      if (!isPro && dayOffset < -FREE_HISTORY_DAYS) {
        openPaywall({ source: "history" });
        return;
      }
      onPickDate(date);
    },
    [displayYear, displayMonth, today, isPro, onPickDate],
  );

  const CELL = 40;
  const iconBtn = {
    padding: t.space[2],
    minWidth: t.minTouchTarget,
    minHeight: t.minTouchTarget,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={62}
      title={i18n.t("daynav.picker.title")}
    >
      {/* Month navigation */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: t.space[3] }}>
        <Pressable onPress={prevMonth} hitSlop={12} accessibilityRole="button" style={iconBtn}>
          <Icon name="chevron-left" size={20} color={t.color("color.fg2")} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: t.type.size.m,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
          }}
        >
          {monthLabel}
        </Text>
        <Pressable
          onPress={nextMonth}
          disabled={!canGoNext}
          hitSlop={12}
          accessibilityRole="button"
          style={[iconBtn, { opacity: canGoNext ? 1 : 0.2 }]}
        >
          <Icon name="chevron-right" size={20} color={t.color("color.fg2")} />
        </Pressable>
      </View>

      {/* Day-of-week column headers */}
      <View style={{ flexDirection: "row", marginBottom: t.space[1] }}>
        {DAY_KEYS.map((key) => (
          <Text
            key={key}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: t.type.size.xs,
              fontWeight: t.type.weight.semibold,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {i18n.t(key as Parameters<typeof i18n.t>[0])}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View>
        {chunk(grid, 7).map((week, wi) => (
          <View key={wi} style={{ flexDirection: "row" }}>
            {week.map((day, di) => {
              if (day == null) {
                return <View key={di} style={{ flex: 1, height: CELL }} />;
              }
              const date = new Date(displayYear, displayMonth, day);
              date.setHours(0, 0, 0, 0);
              const dayOffset = Math.round((date.getTime() - today.getTime()) / 86400000);
              const isFuture = dayOffset > 0;
              const isLocked = !isPro && dayOffset < -FREE_HISTORY_DAYS;
              const isToday = dayOffset === 0;
              const isSelected = day === selectedDay;

              return (
                <Pressable
                  key={di}
                  onPress={() => handleDayPress(day)}
                  disabled={isFuture}
                  style={{ flex: 1, height: CELL, alignItems: "center", justifyContent: "center" }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isToday
                        ? t.color("color.accent")
                        : isSelected
                          ? t.color("color.surface2")
                          : "transparent",
                      borderWidth: isSelected && !isToday ? 1.5 : 0,
                      borderColor: t.color("color.accent"),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: t.type.size.s,
                        fontFamily: t.type.family.sans,
                        fontVariant: ["tabular-nums"],
                        color: isFuture
                          ? t.color("color.fg3")
                          : isToday
                            ? t.color("color.accent.contrast")
                            : isLocked
                              ? t.color("color.fg3")
                              : t.color("color.fg"),
                        opacity: isFuture ? 0.3 : 1,
                      }}
                    >
                      {day}
                    </Text>
                    {isLocked ? (
                      <View style={{ position: "absolute", bottom: 1, right: 2 }}>
                        <Icon name="lock" size={7} color={t.color("color.fg3")} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Sheet>
  );
}
