import React from "react";
import { Pressable } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, type IconName } from "./Icon";

type Props = {
  icon: IconName;
  onPress: () => void;
  /**
   * Accessibility label is required — the icon alone isn't a useful
   * label. Consumers should pass a localized string describing the
   * action (e.g. "Add entry", "Add place").
   */
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
  /** Optional override for when the default accent doesn't fit. */
  tone?: "accent" | "neutral";
};

/**
 * Shared floating action button. 56pt accent circle, intended to sit
 * bottom-right inside a tab screen. The caller wraps it in the
 * positioning container (safe-area-aware `bottom`/`right` offsets);
 * this component only owns the visual primitive.
 *
 * Unifies the four prior variants across Timeline / Stats / Places —
 * all three tabs now use one primitive so the add affordance is
 * visually identical everywhere.
 */
export function Fab({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  tone = "accent",
}: Props) {
  const t = useTheme();
  const bg = tone === "accent" ? t.color("color.accent") : t.color("color.surface2");
  const fg = tone === "accent" ? t.color("color.accent.contrast") : t.color("color.fg");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={t.space[2]}
      testID={testID}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: t.radius.pill,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
        // Subtle elevation — enough to lift from the background without
        // needing a dedicated shadow token.
        shadowColor: t.color("color.fg"),
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      })}
    >
      <Icon name={icon} size={24} color={fg} />
    </Pressable>
  );
}
