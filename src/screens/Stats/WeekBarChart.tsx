import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Card } from "@/components";
import { i18n } from "@/lib/i18n";
import type { DayBuckets, PlaceWeekTotal } from "@/features/entries/useWeekStats";

type Props = {
  /** 7 entries, Mon..Sun, each mapping placeName → minutes. */
  byDay: DayBuckets[];
  /** Per-place totals for the legend — sorted desc by minutes. */
  byPlace: PlaceWeekTotal[];
  testID?: string;
};

const DAY_KEYS = [
  "stats.weekday.mon",
  "stats.weekday.tue",
  "stats.weekday.wed",
  "stats.weekday.thu",
  "stats.weekday.fri",
  "stats.weekday.sat",
  "stats.weekday.sun",
] as const;
const DAY_KEYS_LONG = [
  "stats.weekday.mon.long",
  "stats.weekday.tue.long",
  "stats.weekday.wed.long",
  "stats.weekday.thu.long",
  "stats.weekday.fri.long",
  "stats.weekday.sat.long",
  "stats.weekday.sun.long",
] as const;

/**
 * Stacked bar chart (one column per weekday) + color-dot legend.
 *
 * Scaling: we use a fixed `720` as the "full bar" reference (12 hours of
 * tracked time) — a reasonable cap for a stacked weekday column. If a day
 * exceeds this, segments for that day still render proportional-to-max
 * (clamped to 100% of the bar height).
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
    <Card padding={5} testID={testID}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: t.space[3],
          // 180 chart height (bars 160 + label row ~20).
          height: 180,
        }}
      >
        {DAY_KEYS.map((dayKey, i) => {
          const label = i18n.t(dayKey);
          const longLabel = i18n.t(DAY_KEYS_LONG[i]!);
          const dayBuckets = byDay[i] ?? {};
          const daySumMinutes = Object.values(dayBuckets).reduce((a, b) => a + b, 0);
          const breakdown = placeLegend
            .map((p) => ({ name: p.name, minutes: dayBuckets[p.name] ?? 0 }))
            .filter((x) => x.minutes > 0);
          const a11yLabel =
            breakdown.length === 0
              ? i18n.t("stats.a11y.dayEmpty", { day: longLabel })
              : i18n.t("stats.a11y.dayTotal", {
                  day: longLabel,
                  total: formatTotal(daySumMinutes),
                }) +
                " — " +
                breakdown.map((x) => `${x.name}: ${formatTotal(x.minutes)}`).join(", ");
          return (
            <View
              key={dayKey}
              testID={`week-bar-${label.toLowerCase()}`}
              accessible
              accessibilityRole="text"
              accessibilityLabel={a11yLabel}
              style={{
                flex: 1,
                alignItems: "center",
                gap: t.space[2],
                height: "100%",
              }}
            >
              <View
                style={{
                  height: 160, // bar column height
                  width: 18, // bar column width
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
                  width: 10, // legend dot
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
      ) : (
        // An empty bar chart with no legend reads "broken" without copy. Soft
        // muted line below the (empty) columns so users know it's a zero
        // state, not a fetch failure.
        <View style={{ marginTop: t.space[5], alignItems: "center" }}>
          <Text
            testID="week-bar-chart-empty"
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("stats.empty.week")}
          </Text>
        </View>
      )}
    </Card>
  );
}

function formatTotal(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
