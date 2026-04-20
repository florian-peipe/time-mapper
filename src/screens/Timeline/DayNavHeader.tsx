import React, { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { localeForDateApis } from "@/lib/time";
import { MODES, PERIOD_DAYS, type RangeMode } from "@/lib/range";
import { openSheet as openPaywallIfGated } from "@/screens/Timeline/dayNavGuard";

type Props = {
  mode: RangeMode;
  /** 0 = current period; -1 = one period back; +1 is forbidden (caller clamps). */
  offset: number;
  /** Total tracked minutes inside the current period. */
  totalMin: number;
  /** True when the user has a Pro entitlement — gates history beyond the free cap. */
  isPro?: boolean;
  onChangeMode: (next: RangeMode) => void;
  onChangeOffset: (next: number) => void;
  testID?: string;
};

/**
 * Hard cap on free-tier history depth, counted in days. Same number the
 * Pro upsell advertises; all modes translate their offset into days via
 * `PERIOD_DAYS` and compare.
 */
export const FREE_HISTORY_DAYS = 14;

/**
 * Header bar shown at the top of Timeline: `< [period label + total] >`.
 *
 * Tapping the label cycles the aggregation mode forward
 * (Day → Week → Month → Year → Day). Long-pressing cycles backward for
 * quick long-range jumps. Chevrons step `offset` within the current mode.
 *
 * Free users hitting a back-nav that would land beyond `FREE_HISTORY_DAYS`
 * get the paywall instead of the nav.
 */
export function DayNavHeader({
  mode,
  offset,
  totalMin,
  isPro,
  onChangeMode,
  onChangeOffset,
  testID,
}: Props) {
  const t = useTheme();

  const forwardDisabled = offset >= 0;
  const label = formatPeriodLabel(mode, offset);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  const goBack = useCallback(() => {
    const next = offset - 1;
    if (!isPro && Math.abs(next) * PERIOD_DAYS[mode] > FREE_HISTORY_DAYS) {
      openPaywallIfGated();
      return;
    }
    onChangeOffset(next);
  }, [onChangeOffset, offset, isPro, mode]);

  const goForward = useCallback(() => {
    if (forwardDisabled) return;
    onChangeOffset(Math.min(0, offset + 1));
  }, [onChangeOffset, offset, forwardDisabled]);

  const cycleModeForward = useCallback(() => {
    const idx = MODES.indexOf(mode);
    const next = MODES[(idx + 1) % MODES.length]!;
    onChangeMode(next);
    // Reset offset when the mode changes — offsets are period-scoped, so
    // staying on "-3 days" after flipping to Week would jump to "-3 weeks"
    // which is rarely what the user intended.
    onChangeOffset(0);
  }, [mode, onChangeMode, onChangeOffset]);

  const cycleModeBackward = useCallback(() => {
    const idx = MODES.indexOf(mode);
    const next = MODES[(idx - 1 + MODES.length) % MODES.length]!;
    onChangeMode(next);
    onChangeOffset(0);
  }, [mode, onChangeMode, onChangeOffset]);

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

      <Pressable
        onPress={cycleModeForward}
        onLongPress={cycleModeBackward}
        accessibilityRole="button"
        accessibilityLabel={modeA11yLabel(mode)}
        accessibilityHint={i18n.t("daynav.mode.hint")}
        testID={testID ? `${testID}-mode` : undefined}
        style={{ flex: 1, alignItems: "center" }}
      >
        <Text
          style={{
            fontSize: t.type.size.l,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            letterSpacing: -0.3,
          }}
        >
          {label}
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
      </Pressable>

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

function modeA11yLabel(mode: RangeMode): string {
  switch (mode) {
    case "day":
      return i18n.t("daynav.mode.day");
    case "week":
      return i18n.t("daynav.mode.week");
    case "month":
      return i18n.t("daynav.mode.month");
    case "year":
      return i18n.t("daynav.mode.year");
  }
}

function formatPeriodLabel(mode: RangeMode, offset: number): string {
  switch (mode) {
    case "day":
      return formatDayLabel(offset);
    case "week":
      return formatWeekLabel(offset);
    case "month":
      return formatMonthLabel(offset);
    case "year":
      return formatYearLabel(offset);
  }
}

function formatDayLabel(offset: number): string {
  if (offset === 0) return i18n.t("daynav.label.today");
  if (offset === -1) return i18n.t("daynav.label.yesterday");
  const date = new Date(Date.now() + offset * 86_400_000);
  return date.toLocaleDateString(localeForDateApis(), {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatWeekLabel(offset: number): string {
  if (offset === 0) return i18n.t("daynav.label.thisWeek");
  if (offset === -1) return i18n.t("daynav.label.lastWeek");
  const { start, end } = computeWeekBounds(offset);
  const locale = localeForDateApis();
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return i18n.t("daynav.label.weekOf", {
    range: `${start.toLocaleDateString(locale, fmt)}–${end.toLocaleDateString(locale, fmt)}`,
  });
}

function formatMonthLabel(offset: number): string {
  if (offset === 0) return i18n.t("daynav.label.thisMonth");
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString(localeForDateApis(), { month: "long", year: "numeric" });
}

function formatYearLabel(offset: number): string {
  if (offset === 0) return i18n.t("daynav.label.thisYear");
  const year = new Date().getFullYear() + offset;
  return String(year);
}

function computeWeekBounds(offset: number): { start: Date; end: Date } {
  // Anchor on local Monday — matches the German convention used in Stats.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - mondayOffset + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}
