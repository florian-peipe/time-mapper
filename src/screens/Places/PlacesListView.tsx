import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";
import type { IconName } from "@/components";
import type { Place } from "@/db/schema";

export type PlacesListViewProps = {
  places: Place[];
  onPressPlace: (placeId: string) => void;
};

export function PlacesListView({ places, onPressPlace }: PlacesListViewProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Bottom padding stacks the tab bar height + the safe-area inset + a
  // breathing gap so the last row clears the FAB cleanly.
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: t.space[5],
        paddingBottom: t.space[14] + insets.bottom + t.space[5],
      }}
    >
      {places.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPressPlace(p.id)}
          accessibilityRole="button"
          accessibilityLabel={p.name}
          accessibilityHint={i18n.t("common.edit")}
          testID={`places-list-row-${p.id}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.space[3],
            paddingVertical: t.space[3],
            paddingHorizontal: t.space[3],
            marginBottom: t.space[2],
            backgroundColor: t.color("color.surface"),
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.color("color.border"),
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: t.radius.pill,
              backgroundColor: p.color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={p.icon as IconName} size={20} color={t.color("color.accent.contrast")} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: t.type.size.body,
                fontWeight: t.type.weight.semibold,
                color: t.color("color.fg"),
                fontFamily: t.type.family.sans,
              }}
            >
              {p.name}
            </Text>
            {p.address ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: t.type.size.s,
                  color: t.color("color.fg3"),
                  fontFamily: t.type.family.sans,
                  marginTop: 2,
                }}
              >
                {p.address}
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              fontVariant: ["tabular-nums"],
            }}
          >
            {p.radiusM}m
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
