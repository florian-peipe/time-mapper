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
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean;
    busy?: boolean;
  };
  testID?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  disabled,
  onPress,
  children,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
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
      onPress={loading || disabled ? undefined : onPress}
      disabled={loading || disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled ?? loading ?? accessibilityState?.disabled,
        busy: loading ?? accessibilityState?.busy,
        selected: accessibilityState?.selected,
        checked: accessibilityState?.checked,
      }}
      testID={testID}
      style={({ pressed }): StyleProp<ViewStyle> => [
        styles.base,
        {
          minHeight: Math.max(sizing.height, t.minTouchTarget),
          height: sizing.height,
          paddingHorizontal: sizing.paddingH,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: t.radius.pill,
          width: full ? "100%" : undefined,
          opacity: loading || disabled ? 0.6 : 1,
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
