import React from "react";
import { Text, View } from "react-native";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";

const FEATURE_KEYS = [
  "paywall.features.unlimited",
  "paywall.features.history",
  "paywall.features.reports",
  "paywall.features.export",
] as const;

export function PaywallFeaturesList() {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.space[5] }}>
      {FEATURE_KEYS.map((key) => (
        <View
          key={key}
          style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: t.space[2] }}
        >
          <Text
            style={{
              color: t.color("color.success"),
              fontSize: t.type.size.body,
              marginRight: t.space[2],
              lineHeight: t.type.size.body * 1.4,
            }}
          >
            ✓
          </Text>
          <Text
            style={{
              fontFamily: t.type.family.sans,
              fontSize: t.type.size.body,
              color: t.color("color.fg"),
              flex: 1,
              lineHeight: t.type.size.body * 1.4,
            }}
          >
            {i18n.t(key)}
          </Text>
        </View>
      ))}
    </View>
  );
}
