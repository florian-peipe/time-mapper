import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, Input, WidgetBoundary } from "@/components";
import { i18n } from "@/lib/i18n";
import { MapPreview } from "./MapPreview";
import type { Selection } from "./usePlaceForm";

/**
 * Name input + formatted-address preview + MapPreview as one unit. Rendered
 * as a Fragment so the outer Phase2DetailsForm column can apply its
 * inter-section `gap` to each of the three children uniformly. Keeping this
 * dumb (parent owns `name`/`onChangeName`) matches the Phase-2 contract.
 */
export function AddressPreviewCard({
  selected,
  name,
  onChangeName,
  radius,
  chosenColor,
}: {
  selected: Selection;
  name: string;
  onChangeName: (v: string) => void;
  /** Current geofence radius in meters — drives the MapPreview circle. */
  radius: number;
  /** Currently-picked place color — stroke/fill of the MapPreview circle. */
  chosenColor: string;
}) {
  const t = useTheme();
  return (
    <>
      {/* Name field. */}
      <View style={{ flexDirection: "column", gap: t.space[1] + 2 }}>
        <Text
          accessibilityRole="text"
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

      {/* Address preview card. */}
      <View
        accessibilityRole="text"
        accessibilityLabel={`${i18n.t("addPlace.field.address")}, ${selected.description}`}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: t.space[3] - 2,
          paddingVertical: t.space[3],
          paddingHorizontal: 14,
          backgroundColor: t.color("color.surface2"),
          borderRadius: t.radius.md - 2,
        }}
      >
        <View style={{ marginTop: 2 }}>
          <Icon name="map-pin" size={18} color={t.color("color.fg2")} />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: t.type.size.body - 1,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
          }}
        >
          {selected.description}
        </Text>
      </View>

      {/*
        Map preview — only rendered when we have real coordinates.
        Demo-mode picks (offline fallback) + freshly-resolved Photon
        picks both carry lat/lng. Hide the preview when either is 0
        rather than drawing a pin in the middle of the Atlantic.
      */}
      {selected.latitude !== 0 || selected.longitude !== 0 ? (
        <WidgetBoundary scope="addPlace.mapPreview">
          <MapPreview
            latitude={selected.latitude}
            longitude={selected.longitude}
            radiusM={radius}
            color={chosenColor}
            testID="add-place-map-preview"
          />
        </WidgetBoundary>
      ) : null}
    </>
  );
}
