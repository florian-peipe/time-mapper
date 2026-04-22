import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Chip, Icon, PlaceBubble, type IconName } from "@/components";
import { i18n } from "@/lib/i18n";
import type { Place } from "@/db/schema";

export type PlacePickerSectionProps = {
  places: Place[];
  selectedPlace: Place | null;
  onSelect: (placeId: string) => void;
};

export function PlacePickerSection({ places, selectedPlace, onSelect }: PlacePickerSectionProps) {
  const t = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePickPlace = useCallback(
    (p: Place) => {
      onSelect(p.id);
      setPickerOpen(false);
    },
    [onSelect],
  );

  return (
    <View
      style={{
        backgroundColor: t.color("color.surface"),
        borderWidth: 1,
        borderColor: t.color("color.border"),
        borderRadius: t.radius.md,
        marginBottom: t.space[4],
        overflow: "hidden",
      }}
    >
      <Pressable
        testID="entry-edit-place-row"
        onPress={() => setPickerOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={i18n.t("entryEdit.label.selectPlace")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: t.space[4],
          borderBottomWidth: pickerOpen ? 1 : 0,
          borderBottomColor: t.color("color.border"),
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
            width: 78,
          }}
        >
          {i18n.t("entryEdit.label.place")}
        </Text>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: t.space[2] + 2,
          }}
        >
          {selectedPlace ? (
            <>
              <PlaceBubble
                icon={(selectedPlace.icon as IconName) ?? "map-pin"}
                color={selectedPlace.color}
                size={28}
              />
              <Text
                style={{
                  fontSize: t.type.size.body,
                  fontWeight: t.type.weight.medium,
                  color: t.color("color.fg"),
                  fontFamily: t.type.family.sans,
                }}
              >
                {selectedPlace.name}
              </Text>
            </>
          ) : (
            <Text
              style={{
                fontSize: t.type.size.body,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
              }}
            >
              {i18n.t("entryEdit.label.placeNone")}
            </Text>
          )}
        </View>
        <Icon name="chevron-right" size={16} color={t.color("color.fg3")} />
      </Pressable>
      {pickerOpen ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: t.space[2],
            padding: t.space[3] - 2,
          }}
        >
          {places.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              selected={p.id === selectedPlace?.id}
              onPress={() => handlePickPlace(p)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
