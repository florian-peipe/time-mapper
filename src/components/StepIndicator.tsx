import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";

export type StepIndicatorProps = {
  /** 1-based index of the current step. */
  current: number;
  /** Total number of steps. */
  total: number;
  testID?: string;
};

/**
 * Small row of dots showing onboarding progress. Active dot uses the accent
 * soft background + accent fill, inactive dots use border tone. Pure visual
 * aid — no interaction — so we leave it `accessible={false}` so screen readers
 * don't announce every dot; the headers on each step give VoiceOver the
 * "step 2 of 3" context via order.
 */
export function StepIndicator({ current, total, testID }: StepIndicatorProps) {
  const t = useTheme();
  const dots = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <View
      accessible={false}
      testID={testID}
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: t.space[2],
      }}
    >
      {dots.map((n) => {
        const active = n === current;
        return (
          <View
            key={n}
            testID={testID ? `${testID}-dot-${n}` : undefined}
            style={{
              height: 6,
              width: active ? 20 : 6,
              borderRadius: t.radius.pill,
              backgroundColor: active ? t.color("color.accent") : t.color("color.border.strong"),
            }}
          />
        );
      })}
    </View>
  );
}
