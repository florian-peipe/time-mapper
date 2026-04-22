import React from "react";
import { Text, View } from "react-native";
import { Button, Rings } from "@/components";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";

export type PlacesEmptyStateProps = {
  onAdd: () => void;
};

export function PlacesEmptyState({ onAdd }: PlacesEmptyStateProps) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: t.space[5],
      }}
    >
      {/* Decorative Rings sit behind the text. pointerEvents=none so they
          never intercept taps on the CTA. */}
      <View pointerEvents="none" style={{ position: "absolute", alignItems: "center" }}>
        <Rings size={280} opacity={0.07} />
      </View>
      <View style={{ alignItems: "center", gap: t.space[3], maxWidth: 320 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: t.type.size.l,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            letterSpacing: -0.3,
          }}
        >
          {i18n.t("places.empty.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.body,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            lineHeight: t.type.size.body * t.type.lineHeight.body,
          }}
        >
          {i18n.t("places.empty.body")}
        </Text>
        <Button variant="primary" size="md" onPress={onAdd} testID="places-empty-add">
          {i18n.t("places.empty.cta")}
        </Button>
      </View>
    </View>
  );
}
