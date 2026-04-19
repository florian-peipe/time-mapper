import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = {
  /** Optional uppercase caption shown above the card. */
  title?: string;
  children: React.ReactNode;
  testID?: string;
};

/**
 * Grouped list card used in Settings. Renders an optional uppercase caption
 * above a rounded card wrapping a stack of ListRows.
 *
 * Horizontal margin uses `space[5]` (20) to match ScreenShell's 20px screen
 * padding so the card edges line up with every other screen.
 */
export function Section({ title, children, testID }: Props) {
  const t = useTheme();

  return (
    <View testID={testID} style={{ marginBottom: t.space[5] }}>
      {title ? (
        <Text
          accessibilityRole="header"
          accessibilityLabel={title}
          style={{
            fontSize: t.type.size.xs,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            letterSpacing: 0.6,
            paddingHorizontal: t.space[5],
            paddingBottom: t.space[2],
          }}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View
        style={{
          marginHorizontal: t.space[5],
          backgroundColor: t.color("color.surface"),
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: t.color("color.border"),
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}
