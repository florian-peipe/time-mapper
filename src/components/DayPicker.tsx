import React from "react";
import { View } from "react-native";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";
import { Chip } from "./Chip";

/**
 * ISO day numbers for the chip row (1 = Mon … 7 = Sun). Matches the
 * storage format in `places.dailyGoalDays`.
 */
export const ISO_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7] as const;

const I18N_KEYS: Record<number, string> = {
  1: "dayPicker.short.mon",
  2: "dayPicker.short.tue",
  3: "dayPicker.short.wed",
  4: "dayPicker.short.thu",
  5: "dayPicker.short.fri",
  6: "dayPicker.short.sat",
  7: "dayPicker.short.sun",
};

type Props = {
  /** Current selection as ISO day numbers (1..7). */
  value: number[];
  /** Called with the next selection after a tap. Parent owns state. */
  onChange: (days: number[]) => void;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * Seven short-label chips (Mon..Sun) with multi-select toggle. Like
 * the iOS alarm "Repeat" row: tap a day to include it, tap again to
 * remove. Parent stores the result as a comma-separated string in
 * `places.dailyGoalDays`.
 */
export function DayPicker({ value, onChange, testID, accessibilityLabel }: Props) {
  const t = useTheme();
  const selected = new Set(value);

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: "row", gap: t.space[2], flexWrap: "wrap" }}
    >
      {ISO_DAYS.map((iso) => {
        const label = i18n.t(I18N_KEYS[iso]!);
        const isOn = selected.has(iso);
        return (
          <Chip
            key={iso}
            label={label}
            selected={isOn}
            onPress={() => {
              const next = new Set(selected);
              if (isOn) next.delete(iso);
              else next.add(iso);
              onChange(Array.from(next).sort((a, b) => a - b));
            }}
            testID={testID ? `${testID}-day-${iso}` : undefined}
          />
        );
      })}
    </View>
  );
}
