import React from "react";
import { Text, View } from "react-native";
import { Button, Rings } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

/**
 * Empty state for when the user HAS places but no entries today (and
 * nothing is currently tracking). Copy reassures them tracking is
 * armed, and offers a tertiary "Add another place" nudge so the path
 * to growing their place list stays visible.
 */
export function NoEntriesEmptyState({ onAddAnotherPlace }: { onAddAnotherPlace: () => void }) {
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
        <Rings size={240} opacity={0.07} />
      </View>
      <View style={{ marginTop: t.space[10], alignItems: "center", gap: t.space[2] }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: t.type.size.m,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
          }}
        >
          {i18n.t("timeline.emptyTrackedReady.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.body,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            maxWidth: 300,
            lineHeight: t.type.size.body * t.type.lineHeight.body,
          }}
        >
          {i18n.t("timeline.emptyTrackedReady.body")}
        </Text>
        <View style={{ marginTop: t.space[2] }}>
          <Button
            variant="tertiary"
            size="sm"
            onPress={onAddAnotherPlace}
            testID="timeline-add-another-place"
          >
            {i18n.t("timeline.emptyTrackedReady.cta")}
          </Button>
        </View>
      </View>
    </View>
  );
}
