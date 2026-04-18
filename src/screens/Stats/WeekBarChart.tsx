import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Card } from "@/components";
import type { DayBuckets, PlaceWeekTotal } from "@/features/entries/useWeekStats";

type Props = {
  /** 7 entries, Mon..Sun, each mapping placeName → minutes. */
  byDay: DayBuckets[];
  /** Per-place totals for the legend — sorted desc by minutes. */
  byPlace: PlaceWeekTotal[];
  testID?: string;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Stacked bar chart (one column per weekday) + color-dot legend.
 * Source: design-system Screens.jsx → StatsScreen chart block.
 *
 * Scaling: we use a fixed `720` as the "full bar" reference (12 hours of
 * tracked time) — matches the design-system mock and is a reasonable cap
 * for a stacked weekday column. If a day exceeds this, segments for that
 * day still render proportional-to-max (clamped to 100% of the bar height).
 *
 * We derive a stable rendering order across days by iterating `byPlace` (the
 * legend order). Missing places on a given day show as a zero-height strip
 * so columns align.
 */
export function WeekBarChart({ byDay, byPlace, testID }: Props) {
  const t = useTheme();

  // 720 minutes = 12h. Pick the larger of [720, max observed] so overflow is
  // still visible relative to other days.
  const observedMax = byDay.reduce((maxSoFar, day) => {
    const daySum = Object.values(day).reduce((a, b) => a + b, 0);
    return daySum > maxSoFar ? daySum : maxSoFar;
  }, 0);
  const referenceMax = Math.max(720, observedMax);

  const placeLegend = byPlace;

  return (
    <Card variant="tile" padding={5} testID={testID}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: t.space[3],
          // 180 == design-system chart height (bars are 160, label row adds ~20)
          height: 180, // mono grid, design-system chart height
        }}
      >
        {DAY_LABELS.map((label, i) => {
          const dayBuckets = byDay[i] ?? {};
          return (
            <View
              key={label}
              testID={`week-bar-${label.toLowerCase()}`}
              style={{
                flex: 1,
                alignItems: "center",
                gap: t.space[2],
                height: "100%",
              }}
            >
              <View
                style={{
                  height: 160, // bar column height, design-system 160
                  width: 18, // bar column width, design-system 18
                  backgroundColor: t.color("color.surface2"),
                  borderRadius: t.radius.sm,
                  overflow: "hidden",
                  flexDirection: "column-reverse",
                }}
              >
                {placeLegend.map((p) => {
                  const minutes = dayBuckets[p.name] ?? 0;
                  if (minutes === 0) return null;
                  const pct = Math.min(100, (minutes / referenceMax) * 100);
                  return (
                    <View
                      key={p.name}
                      testID={`week-bar-${label.toLowerCase()}-${p.name.toLowerCase()}`}
                      style={{
                        height: `${pct}%`,
                        width: "100%",
                        backgroundColor: p.color,
                      }}
                    />
                  );
                })}
              </View>
              <Text
                style={{
                  fontSize: t.type.size.xs,
                  color: t.color("color.fg3"),
                  fontWeight: t.type.weight.semibold,
                  fontFamily: t.type.family.sans,
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {placeLegend.length > 0 ? (
        <View style={{ marginTop: t.space[5], gap: t.space[3] }}>
          {placeLegend.map((p) => (
            <View
              key={p.name}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: t.space[3],
              }}
            >
              <View
                style={{
                  width: 10, // legend dot, design-system 10
                  height: 10,
                  borderRadius: t.radius.sm,
                  backgroundColor: p.color,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: t.type.size.s,
                  color: t.color("color.fg"),
                  fontFamily: t.type.family.sans,
                }}
              >
                {p.name}
              </Text>
              <Text
                style={{
                  fontSize: t.type.size.s,
                  fontWeight: t.type.weight.semibold,
                  color: t.color("color.fg"),
                  fontFamily: t.type.family.sans,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatTotal(p.totalMin)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function formatTotal(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
