import React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { tryLoadNativeMaps, isNativeMapUsable } from "@/lib/nativeMaps";

export type MapPreviewProps = {
  /** Center latitude. */
  latitude: number;
  /** Center longitude. */
  longitude: number;
  /** Geofence radius in meters. Rendered as a translucent circle. */
  radiusM: number;
  /** Color of the pin + circle stroke. Usually the current place color. */
  color: string;
  testID?: string;
  /** Override the outer container style — e.g. pass { borderRadius: 0 } when
   *  the parent already clips with overflow:hidden. */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Derive a latitude/longitude delta pair from a radius. The iOS MapKit
 * `region` API wants a viewport in degrees, not meters: 1° of latitude ≈
 * 111_320m regardless of location, so we convert the radius to lat-degrees,
 * then pad 2.5× so the circle doesn't crop against the viewport edge. We
 * apply the same delta to longitude — a slight over-zoom at high latitudes,
 * but acceptable for a 180px preview.
 */
function regionFromRadius(lat: number, lng: number, radiusM: number) {
  const METERS_PER_DEGREE = 111_320;
  const delta = Math.max((radiusM / METERS_PER_DEGREE) * 2.5, 0.001);
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

/** Neutral 180-pt placeholder shown when the map SDK or key is absent. */
function MapPlaceholder({
  testID,
  containerStyle,
}: {
  testID?: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          height: 180,
          borderRadius: t.radius.md,
          backgroundColor: t.color("color.surface2"),
          alignItems: "center",
          justifyContent: "center",
          gap: t.space[2],
        },
        containerStyle,
      ]}
    >
      <Icon name="map" size={22} color={t.color("color.fg3")} />
      <Text
        style={{
          fontSize: t.type.size.xs,
          color: t.color("color.fg3"),
          fontFamily: t.type.family.sans,
          textAlign: "center",
          paddingHorizontal: t.space[5],
          lineHeight: t.type.size.xs * t.type.lineHeight.body,
        }}
      >
        {i18n.t("addPlace.map.placeholderHint")}
      </Text>
    </View>
  );
}

/**
 * 180-pt tall map preview centered on a place, with a marker pin and a
 * translucent circle at the geofence radius. Non-interactive — the user picks
 * the address via autocomplete, then sees what the geofence will cover.
 *
 * Graceful degradation: when the map SDK is absent or the Android key is
 * missing, renders a neutral surface-2 placeholder at the same footprint.
 */
export function MapPreview({
  latitude,
  longitude,
  radiusM,
  color,
  testID,
  containerStyle,
}: MapPreviewProps) {
  const t = useTheme();
  const Maps = React.useMemo(() => tryLoadNativeMaps(), []);
  const mapUsable = React.useMemo(() => isNativeMapUsable(), []);

  if (!Maps || !mapUsable) {
    return (
      <MapPlaceholder
        testID={testID ? `${testID}-fallback` : undefined}
        containerStyle={containerStyle}
      />
    );
  }

  const MapView = Maps.default;
  const { Marker, Circle } = Maps;
  const region = regionFromRadius(latitude, longitude, radiusM);

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={i18n.t("addPlace.map.accessibilityLabel")}
      style={[
        {
          height: 180,
          borderRadius: t.radius.md,
          overflow: "hidden",
          backgroundColor: t.color("color.surface2"),
        },
        containerStyle,
      ]}
    >
      <MapView
        style={{ flex: 1 }}
        initialRegion={region}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={{ latitude, longitude }} pinColor={color} />
        <Circle
          center={{ latitude, longitude }}
          radius={radiusM}
          strokeColor={color}
          fillColor={`${color}33`} // ~20% alpha
          strokeWidth={2}
        />
      </MapView>
    </View>
  );
}
