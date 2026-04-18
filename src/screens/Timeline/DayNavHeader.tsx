import React, { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";

type Props = {
  /** 0 = today, -1 = yesterday, +1 is forbidden (future); caller clamps. */
  dayOffset: number;
  /** Total tracked minutes for the current day. */
  totalMin: number;
  onChangeDay: (next: number) => void;
  testID?: string;
};

/**
 * Header bar shown at the top of Timeline: `< [day label + total] >`.
 *
 * `onChangeDay` receives the new offset; we clamp the forward direction to 0
 * here so callers don't have to. The right chevron is visually disabled on
 * today (reduced opacity + `accessibilityState.disabled`).
 *
 * Source: design-system Screens.jsx → TimelineScreen header.
 */
export function DayNavHeader({ dayOffset, totalMin, onChangeDay, testID }: Props) {
  const t = useTheme();

  const forwardDisabled = dayOffset >= 0;

  const dayLabel = formatDayLabel(dayOffset);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  const goBack = useCallback(() => {
    onChangeDay(dayOffset - 1);
  }, [onChangeDay, dayOffset]);

  const goForward = useCallback(() => {
    if (forwardDisabled) return;
    onChangeDay(Math.min(0, dayOffset + 1));
  }, [onChangeDay, dayOffset, forwardDisabled]);

  // 36px circle matches the design-system `iconBtn` helper in Screens.jsx.
  // Sheet uses the same literal for its close button — no token for this size.
  const iconBtn = {
    width: 36, // icon-button size, design-system iconBtn
    height: 36, // icon-button size, design-system iconBtn
    borderRadius: t.radius.pill,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <View
      testID={testID}
      style={{
        paddingTop: t.space[2],
        paddingHorizontal: t.space[5],
        paddingBottom: t.space[3],
        flexDirection: "row",
        alignItems: "center",
        gap: t.space[2],
      }}
    >
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        hitSlop={8}
        style={iconBtn}
      >
        <Icon name="chevron-left" size={20} color={t.color("color.fg2")} />
      </Pressable>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          style={{
            fontSize: t.type.size.l,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            letterSpacing: -0.3,
          }}
        >
          {dayLabel}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.xs,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            marginTop: 2,
            fontVariant: ["tabular-nums"],
          }}
        >
          {hours}h {minutes}m tracked
        </Text>
      </View>

      <Pressable
        onPress={goForward}
        accessibilityRole="button"
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: forwardDisabled }}
        disabled={forwardDisabled}
        hitSlop={8}
        style={[iconBtn, { opacity: forwardDisabled ? 0.3 : 1 }]}
      >
        <Icon name="chevron-right" size={20} color={t.color("color.fg2")} />
      </Pressable>
    </View>
  );
}

/**
 * Today / Yesterday / weekday + date for older days. Kept inline rather than
 * routing through i18n — Plan 1 only ships `timeline.empty.title`, and the
 * day label here is terse enough that we can batch-translate in Plan 3.
 */
function formatDayLabel(dayOffset: number): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === -1) return "Yesterday";
  const date = new Date(Date.now() + dayOffset * 86_400_000);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
