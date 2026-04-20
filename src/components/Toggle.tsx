import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = {
  /** Current state. Parent owns the boolean. */
  checked: boolean;
  /** For tests + a11y. No affordance for disabled — callers wrap a disabled Pressable. */
  testID?: string;
};

/**
 * Pill-switch. Pure visual — does NOT own state or handle presses. Wrap it
 * in a `<Pressable>` or similar and call your own toggle handler; the
 * component just reflects `checked`. Used by
 *   - NotificationsSheet (quiet-hours + daily-digest toggles)
 *   - AddPlaceSheet (per-place daily + weekly goal enabled flags)
 * Consolidates identical geometry (44×26 pill, 20×20 thumb, accent when
 * on) that had drifted across three inline copies.
 */
export function Toggle({ checked, testID }: Props) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{
        width: 44,
        height: 26,
        borderRadius: t.radius.pill,
        backgroundColor: checked ? t.color("color.accent") : t.color("color.border.strong"),
        justifyContent: "center",
        paddingHorizontal: 3,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: t.radius.pill,
          backgroundColor: t.color("color.accent.contrast"),
          alignSelf: checked ? "flex-end" : "flex-start",
        }}
      />
    </View>
  );
}
