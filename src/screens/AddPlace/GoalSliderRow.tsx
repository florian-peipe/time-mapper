import React from "react";
import { Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { Toggle } from "@/components";
import { i18n } from "@/lib/i18n";
import { DayPicker } from "./DayPicker";

/**
 * Toggle-guarded hour slider for per-place daily / weekly goals.
 *
 * When `enabled` is false the toggle sits alone and the slider is hidden;
 * flipping it on reveals the slider (and, for the daily variant, the day-of-week
 * picker) with the current `hours` value.
 */
export function GoalSliderRow({
  label,
  enabled,
  hours,
  minValue,
  maxValue,
  onToggle,
  onChangeHours,
  daysValue,
  onDaysChange,
  testID,
}: {
  label: string;
  enabled: boolean;
  hours: number;
  minValue: number;
  maxValue: number;
  onToggle: (next: boolean) => void;
  onChangeHours: (v: number) => void;
  /** Optional day-of-week filter (only supplied for the daily goal). */
  daysValue?: number[];
  onDaysChange?: (next: number[]) => void;
  testID?: string;
}) {
  const t = useTheme();
  const valueLabel = i18n.t("addPlace.goals.hours", { n: hours });
  return (
    <View>
      <Pressable
        onPress={() => onToggle(!enabled)}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: enabled }}
        testID={testID ? `${testID}-toggle` : undefined}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: t.space[2],
        }}
      >
        <View style={{ flex: 1, paddingRight: t.space[3] }}>
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.medium,
            }}
          >
            {label}
          </Text>
          {enabled ? (
            <Text
              style={{
                marginTop: 2,
                fontSize: t.type.size.xs,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
                fontVariant: ["tabular-nums"],
              }}
            >
              {valueLabel}
            </Text>
          ) : null}
        </View>
        <Toggle checked={enabled} />
      </Pressable>
      {enabled ? (
        <Slider
          // Remount on toggle-on so the UISlider's thumb syncs with the
          // current `hours` value (native iOS bug workaround).
          key={`${testID}-${enabled ? "on" : "off"}`}
          testID={testID}
          minimumValue={minValue}
          maximumValue={maxValue}
          step={1}
          value={hours}
          onValueChange={(v: number) => onChangeHours(Math.round(v))}
          minimumTrackTintColor={t.color("color.accent")}
          maximumTrackTintColor={t.color("color.border")}
          thumbTintColor={t.color("color.accent")}
          style={{ width: "100%", height: 28 }}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: minValue, max: maxValue, now: hours, text: valueLabel }}
        />
      ) : null}
      {enabled && daysValue && onDaysChange ? (
        <View style={{ marginTop: t.space[2], gap: t.space[2] }}>
          <Text
            style={{
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("addPlace.goal.daily.days.title")}
          </Text>
          <DayPicker
            value={daysValue.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : daysValue}
            onChange={onDaysChange}
            testID={testID ? `${testID}-days` : undefined}
            accessibilityLabel={i18n.t("addPlace.goal.daily.days.hint")}
          />
        </View>
      ) : null}
    </View>
  );
}
