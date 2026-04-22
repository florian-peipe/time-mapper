import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

/**
 * Small "Pro" badge rendered in the Export CSV row's detail slot when the
 * user is on the free plan. Looks like a `Chip` (accent palette) but stays
 * inline-typed inside `ListRow.detail`, so we render it as a flat View+Text
 * rather than reaching for the heavier `Chip` primitive (which has its own
 * Pressable + accessibility role and would be incorrect inside a row's
 * trailing accessory area).
 */
export function ProChip() {
  const t = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={i18n.t("settings.proChip")}
      style={{
        paddingVertical: 2,
        paddingHorizontal: t.space[2] - 1,
        backgroundColor: t.color("color.accent.soft"),
        borderRadius: t.radius.pill,
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.xs,
          fontWeight: t.type.weight.bold,
          color: t.color("color.accent"),
          fontFamily: t.type.family.sans,
        }}
      >
        {i18n.t("settings.proChip")}
      </Text>
    </View>
  );
}
