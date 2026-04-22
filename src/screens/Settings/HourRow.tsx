import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { padNumber } from "@/lib/time";

/**
 * Hour-precision stepper (0–23, wraps on both ends) shared by the quiet-hours
 * start/end pickers and the daily-digest hour picker. Hour-only (not HH:MM)
 * because the notifier backend stores hour-granularity; offering a richer
 * picker would invite truncation on save.
 */
export function HourRow({
  label,
  hour,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  hour: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const step = (delta: number) => {
    const next = (((hour + delta) % 24) + 24) % 24;
    onChange(next);
  };
  const hhmm = `${padNumber(hour)}:00`;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: t.space[3],
        paddingHorizontal: t.space[4],
        borderWidth: 1,
        borderColor: t.color("color.border"),
        borderRadius: t.radius.md,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.body,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.medium,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.space[2] }}>
        <Pressable
          testID={testID ? `${testID}-dec` : undefined}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("settings.notifications.decrement")}
          disabled={disabled}
          onPress={() => step(-1)}
          style={{
            width: t.minTouchTarget,
            height: t.minTouchTarget,
            borderRadius: t.radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.color("color.surface2"),
          }}
        >
          <Text
            style={{
              fontSize: t.type.size.l,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.bold,
            }}
          >
            −
          </Text>
        </Pressable>
        <Text
          testID={testID ? `${testID}-value` : undefined}
          style={{
            minWidth: 60,
            textAlign: "center",
            fontSize: t.type.size.l,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.mono,
            fontVariant: ["tabular-nums"],
          }}
        >
          {hhmm}
        </Text>
        <Pressable
          testID={testID ? `${testID}-inc` : undefined}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("settings.notifications.increment")}
          disabled={disabled}
          onPress={() => step(1)}
          style={{
            width: t.minTouchTarget,
            height: t.minTouchTarget,
            borderRadius: t.radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.color("color.surface2"),
          }}
        >
          <Text
            style={{
              fontSize: t.type.size.l,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.bold,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
