import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { tokens } from "@/theme/tokens";

type Props = {
  padding?: keyof (typeof tokens)["space"];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
};

export function Card({ padding, onPress, style, children, testID }: Props) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.color("color.surface"),
    padding: t.space[padding ?? 4],
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color("color.border"),
  };
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
