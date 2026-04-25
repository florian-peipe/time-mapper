import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import type { Place } from "@/db/schema";
import type { RangeMode } from "@/lib/range";
import { formatGoalDelta, pickGoal } from "./statsHelpers";

type Props = {
  place: Place;
  minutes: number;
  /** Largest per-place minutes in the current window — used as the bar scale when there's no goal. */
  max: number;
  mode: RangeMode;
  viewedDate: Date;
};

/**
 * Single row inside SummaryCard: place name, progress bar, minutes +
 * optional goal delta. Renders a green fill when the user has a goal
 * configured and they've already crossed it.
 */
export function PlaceBar({ place, minutes, max, mode, viewedDate }: Props) {
  const t = useTheme();
  const label = formatGoalDelta(minutes);

  const goal = pickGoal(place, mode, viewedDate);
  const hasGoal = goal != null && goal > 0;
  const ratio = hasGoal ? minutes / goal : minutes / max;
  const pct = Math.max(4, Math.min(100, Math.round(ratio * 100)));
  const over = hasGoal ? minutes - goal : 0;
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
            backgroundColor: hasGoal && over > 0 ? t.color("color.success") : place.color,
          }}
        />
      </View>
      <View style={{ minWidth: 72, alignItems: "flex-end" }}>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontVariant: ["tabular-nums"],
          }}
        >
          {label}
        </Text>
        {hasGoal ? (
          <Text
            style={{
              marginTop: 1,
              fontSize: t.type.size.xs,
              color: over > 0 ? t.color("color.success") : t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              fontVariant: ["tabular-nums"],
            }}
            testID={`stats-goal-delta-${place.id}`}
          >
            {over > 0
              ? i18n.t("stats.summary.overBy", { label: formatGoalDelta(over) })
              : over === 0
                ? i18n.t("stats.summary.atGoal")
                : i18n.t("stats.summary.toGoal", { label: formatGoalDelta(-over) })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
