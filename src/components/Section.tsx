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
 * Grouped list card. Source: Screens.jsx SettingsScreen `Section` helper —
 * an uppercase caption with `padding: '0 20px 8px'` and a rounded card
 * `margin: '0 16px'` with `radius.md`, 1px border, and the children (usually
 * a stack of ListRows).
 *
 * We use `space[5]` (20) for the horizontal margin — the README explicitly
 * calls out 20px as the mobile screen horizontal padding; matching it keeps
 * Settings aligned with everything else (ScreenShell also uses space[5]).
 */
export function Section({ title, children, testID }: Props) {
  const t = useTheme();

  return (
    <View testID={testID} style={{ marginBottom: t.space[5] }}>
      {title ? (
        <Text
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
