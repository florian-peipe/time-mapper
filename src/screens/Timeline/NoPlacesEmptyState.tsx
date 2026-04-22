import React from "react";
import { Text, View } from "react-native";
import { Button, Rings } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

/**
 * Hero empty state for when the user has NO places yet. This is the
 * "place-first" primary CTA — adding a place is the only thing to do,
 * and manual entry is hidden entirely (no FAB) so it doesn't compete.
 */
export function NoPlacesEmptyState({ onAddPlace }: { onAddPlace: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: t.space[10] + t.space[5],
        position: "relative",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <Rings size={260} opacity={0.07} />
      </View>
      <View style={{ marginTop: t.space[10], alignItems: "center", gap: t.space[3] }}>
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
          {i18n.t("timeline.emptyNoPlaces.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.body,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            maxWidth: 280,
            lineHeight: t.type.size.body * t.type.lineHeight.body,
          }}
        >
          {i18n.t("timeline.emptyNoPlaces.body")}
        </Text>
        <View style={{ marginTop: t.space[3] }}>
          <Button variant="primary" size="md" onPress={onAddPlace} testID="timeline-add-place-cta">
            {i18n.t("timeline.emptyNoPlaces.cta")}
          </Button>
        </View>
      </View>
    </View>
  );
}
