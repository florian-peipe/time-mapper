import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, Input, WidgetBoundary } from "@/components";
import { i18n } from "@/lib/i18n";
import { MapPreview } from "./MapPreview";
import type { Selection } from "./usePlaceForm";

/**
 * Unified card: name input + address line (with edit pencil) + map preview,
 * all inside a single bordered container. The map bleeds to the card edges
 * via negative margin; the card's overflow:hidden clips its corners.
 */
export function AddressPreviewCard({
  selected,
  name,
  onChangeName,
  radius,
  chosenColor,
  onRequestEditAddress,
}: {
  selected: Selection;
  name: string;
  onChangeName: (v: string) => void;
  /** Current geofence radius in meters — drives the MapPreview circle. */
  radius: number;
  /** Currently-picked place color — stroke/fill of the MapPreview circle. */
  chosenColor: string;
  /** Called when the user taps the pencil to re-pick the address. */
  onRequestEditAddress: () => void;
}) {
  const t = useTheme();
  const hasCoords = selected.latitude !== 0 || selected.longitude !== 0;

  return (
    <View
      style={{
        backgroundColor: t.color("color.surface"),
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.color("color.border"),
        overflow: "hidden",
      }}
    >
      {/* Name + address — padded content area */}
      <View style={{ padding: t.space[4], gap: t.space[3] }}>
        {/* Name field */}
        <View style={{ gap: t.space[1] + 2 }}>
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg2"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.medium,
            }}
          >
            {i18n.t("addPlace.field.name")}
          </Text>
          <Input
            testID="add-place-name"
            value={name}
            onChangeText={onChangeName}
            accessibilityLabel={i18n.t("addPlace.field.name")}
          />
        </View>

        {/* Address line with pencil edit */}
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: t.space[2] }}
          accessibilityRole="text"
          accessibilityLabel={`${i18n.t("addPlace.field.address")}, ${selected.description}`}
        >
          <Icon name="map-pin" size={14} color={t.color("color.fg3")} />
          <Text
            style={{
              flex: 1,
              fontSize: t.type.size.xs + 1,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              lineHeight: (t.type.size.xs + 1) * t.type.lineHeight.snug,
            }}
            numberOfLines={2}
          >
            {selected.description}
          </Text>
          <Pressable
            testID="add-place-address-edit"
            onPress={onRequestEditAddress}
            accessibilityRole="button"
            accessibilityLabel={i18n.t("addPlace.address.edit")}
            hitSlop={t.space[3]}
            style={{ padding: t.space[1] }}
          >
            <Icon name="pencil" size={14} color={t.color("color.fg3")} />
          </Pressable>
        </View>
      </View>

      {/*
        Map preview — bleeds to the card edges via negative horizontal + bottom
        margin, then the parent's overflow:hidden clips it to the card radius.
        Only rendered when we have real coordinates (demo/offline picks carry
        lat/lng=0 and would draw a pin in the middle of the Atlantic).
      */}
      {hasCoords ? (
        <WidgetBoundary scope="addPlace.mapPreview">
          <MapPreview
            latitude={selected.latitude}
            longitude={selected.longitude}
            radiusM={radius}
            color={chosenColor}
            testID="add-place-map-preview"
            containerStyle={{ borderRadius: 0 }}
          />
        </WidgetBoundary>
      ) : null}
    </View>
  );
}
