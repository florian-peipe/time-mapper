import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md";

type Props = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  loading?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  onPress,
  children,
  accessibilityLabel,
  testID,
}: Props) {
  const t = useTheme();
  const sizing =
    size === "sm"
      ? { height: 36, paddingH: 14, fontSize: t.type.size.s }
      : { height: 48, paddingH: 20, fontSize: t.type.size.body };

  const palette = {
    primary: {
      bg: t.color("color.accent"),
      fg: t.color("color.accent.contrast"),
      border: "transparent",
    },
    secondary: {
      bg: "transparent",
      fg: t.color("color.fg"),
      border: t.color("color.border.strong"),
    },
    tertiary: {
      bg: "transparent",
      fg: t.color("color.accent"),
      border: "transparent",
    },
    destructive: {
      bg: "transparent",
      fg: t.color("color.danger"),
      border: t.color("color.danger.soft"),
    },
  }[variant];

  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      disabled={loading}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }): StyleProp<ViewStyle> => [
        styles.base,
        {
          height: sizing.height,
          paddingHorizontal: sizing.paddingH,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: t.radius.pill,
          width: full ? "100%" : undefined,
          opacity: loading ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text
          style={{
            color: palette.fg,
            fontSize: sizing.fontSize,
            fontWeight: t.type.weight.semibold,
            fontFamily: t.type.family.sans,
          }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
