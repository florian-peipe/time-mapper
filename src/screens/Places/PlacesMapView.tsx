import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";
import { tryLoadNativeMaps } from "@/lib/nativeMaps";
import type { Place } from "@/db/schema";

/**
 * Region covering every place + 25% padding so no pin sits on the edge.
 * Minimum span of 0.01° (~1 km) so a single place doesn't render at maximum
 * zoom.
 */
function regionCoveringAll(places: Place[]) {
  if (places.length === 0) {
    return { latitude: 50.9375, longitude: 6.9603, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of places) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }
  const padding = 1.25;
  const latDelta = Math.max((maxLat - minLat) * padding, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * padding, 0.01);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export type PlacesMapViewProps = {
  places: Place[];
  onPressPlace: (placeId: string) => void;
  /** Called when the user long-presses an empty area of the map — used to
   *  trigger a tap-to-create-place flow. */
  onLongPressMap?: (coord: { latitude: number; longitude: number }) => void;
};

export function PlacesMapView({ places, onPressPlace, onLongPressMap }: PlacesMapViewProps) {
  const t = useTheme();
  // Dynamic require keeps this component Expo-Go safe; re-evaluate only once
  // per mount so we don't re-resolve the module on every render.
  const Maps = React.useMemo(() => tryLoadNativeMaps(), []);
  const region = useMemo(() => regionCoveringAll(places), [places]);

  if (!Maps) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: t.space[3],
          padding: t.space[5],
          backgroundColor: t.color("color.surface2"),
        }}
      >
        <Icon name="map" size={32} color={t.color("color.fg3")} />
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            lineHeight: t.type.size.s * t.type.lineHeight.body,
          }}
        >
          {i18n.t("addPlace.map.unavailable")}
        </Text>
      </View>
    );
  }

  const MapView = Maps.default;
  const { Marker, Circle } = Maps;

  return (
    <View style={{ flex: 1 }} accessibilityLabel={i18n.t("places.map.accessibilityLabel")}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onLongPress={
          onLongPressMap
            ? (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) =>
                onLongPressMap(e.nativeEvent.coordinate)
            : undefined
        }
      >
        {places.map((p) => (
          <React.Fragment key={p.id}>
            <Circle
              center={{ latitude: p.latitude, longitude: p.longitude }}
              radius={p.radiusM}
              strokeColor={p.color}
              fillColor={`${p.color}33`}
              strokeWidth={2}
            />
            <Marker
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              pinColor={p.color}
              title={p.name}
              description={p.address}
              onPress={() => onPressPlace(p.id)}
            />
          </React.Fragment>
        ))}
      </MapView>
    </View>
  );
}
