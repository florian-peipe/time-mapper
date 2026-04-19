import React, { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { localeForDateApis } from "@/lib/time";
import { openSheet as openPaywallIfGated } from "@/screens/Timeline/dayNavGuard";

type Props = {
  /** 0 = today, -1 = yesterday, +1 is forbidden (future); caller clamps. */
  dayOffset: number;
  /** Total tracked minutes for the current day. */
  totalMin: number;
  /** True when the user has a Pro entitlement — gates history past 14 days. */
  isPro?: boolean;
  onChangeDay: (next: number) => void;
  testID?: string;
};

/**
 * Hard cap on free-tier history depth. The Pro upsell mirrors the same
 * number; keeping the constant here (not in `sheetStore` or `useWeekStats`)
 * makes it trivial to bump when product decides to change the gate.
 */
export const FREE_HISTORY_DAYS = 14;

/**
 * Header bar shown at the top of Timeline: `< [day label + total] >`.
 *
 * `onChangeDay` receives the new offset; we clamp the forward direction to 0
 * here so callers don't have to. The right chevron is visually disabled on
 * today (reduced opacity + `accessibilityState.disabled`).
 *
 * When the user is on the free plan and attempts to navigate further back
 * than `FREE_HISTORY_DAYS`, we intercept and open the paywall sheet instead
 * of fulfilling the navigation.
 */
export function DayNavHeader({ dayOffset, totalMin, isPro, onChangeDay, testID }: Props) {
  const t = useTheme();

  const forwardDisabled = dayOffset >= 0;

  const dayLabel = formatDayLabel(dayOffset);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  const goBack = useCallback(() => {
    const nextOffset = dayOffset - 1;
    // Free users can step back up to `FREE_HISTORY_DAYS` days; further back
    // opens the paywall instead of the navigation.
    if (!isPro && Math.abs(nextOffset) > FREE_HISTORY_DAYS) {
      openPaywallIfGated();
      return;
    }
    onChangeDay(nextOffset);
  }, [onChangeDay, dayOffset, isPro]);

  const goForward = useCallback(() => {
    if (forwardDisabled) return;
    onChangeDay(Math.min(0, dayOffset + 1));
  }, [onChangeDay, dayOffset, forwardDisabled]);

  // 44px touch target with optional smaller visual — meets WCAG SC 2.5.5 AAA.
  // Previously this was a 36px circle which ships below the 44pt tap-target
  // threshold; keeping the visual compact while widening the hit area is the
  // pragmatic compromise.
  const iconBtn = {
    minWidth: t.minTouchTarget,
    minHeight: t.minTouchTarget,
    width: t.minTouchTarget,
    height: t.minTouchTarget,
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
        testID={testID ? `${testID}-prev` : undefined}
        accessibilityRole="button"
        accessibilityLabel={i18n.t("daynav.label.prev")}
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
          {i18n.t("daynav.label.tracked", { hours, minutes })}
        </Text>
      </View>

      <Pressable
        onPress={goForward}
        testID={testID ? `${testID}-next` : undefined}
        accessibilityRole="button"
        accessibilityLabel={i18n.t("daynav.label.next")}
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
 * Today / Yesterday / weekday + date for older days. Uses the active i18n
 * locale for Date.toLocaleDateString so German users see "Mo., 14. Apr." etc.
 */
function formatDayLabel(dayOffset: number): string {
  if (dayOffset === 0) return i18n.t("daynav.label.today");
  if (dayOffset === -1) return i18n.t("daynav.label.yesterday");
  const date = new Date(Date.now() + dayOffset * 86_400_000);
  return date.toLocaleDateString(localeForDateApis(), {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
