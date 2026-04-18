import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, type Theme } from "@/theme/useTheme";
import type { tokens } from "@/theme/tokens";

export type CardVariant = "tile" | "hero" | "elevated";

type Props = {
  variant: CardVariant;
  /** Spacing token key for inner padding. Defaults: tile=4, hero/elevated=5. */
  padding?: keyof (typeof tokens)["space"];
  onPress?: () => void;
  /**
   * Optional style overlay — lets callers layer a background tint, margin, or
   * explicit dimensions on top of the variant's computed base. Kept last in
   * the style array so it wins any conflict with the base.
   */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
};

// shadow-md from design-system README, mapped to RN's ios + android shadow props
const shadowMd = {
  // iOS
  shadowColor: "#110D09",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  // Android
  elevation: 3,
} as const;

function buildStyle(t: Theme, variant: CardVariant, padding: number): ViewStyle {
  const base: ViewStyle = {
    backgroundColor: t.color("color.surface"),
    padding,
  };
  if (variant === "tile") {
    return {
      ...base,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.color("color.border"),
    };
  }
  if (variant === "hero") {
    return {
      ...base,
      borderRadius: t.radius.md,
      ...shadowMd,
    };
  }
  // elevated
  return {
    ...base,
    borderRadius: t.radius.lg,
    ...shadowMd,
  };
}

export function Card({ variant, padding, onPress, style, children, testID }: Props) {
  const t = useTheme();
  const padPx = t.space[padding ?? (variant === "tile" ? 4 : 5)];
  const base: StyleProp<ViewStyle> = buildStyle(t, variant, padPx);
  const combined: StyleProp<ViewStyle> = style ? [base, style] : base;

  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={combined} accessibilityRole="button">
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={combined}>
      {children}
    </View>
  );
}
