import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Banner } from "@/components";
import { i18n } from "@/lib/i18n";

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
};

/**
 * Dynamic import of `react-native-maps`. Bundled managed Expo builds include
 * the native module automatically; Expo Go (without a custom dev client) does
 * NOT, and Jest can't resolve the ESM re-exports through our existing module
 * transform ignore list. So we `require()` the module lazily and let the
 * caller fall back to a Banner when loading fails.
 */
type MapModule = {
  default: React.ComponentType<Record<string, unknown>>;
  Marker: React.ComponentType<Record<string, unknown>>;
  Circle: React.ComponentType<Record<string, unknown>>;
  PROVIDER_DEFAULT?: unknown;
};

function tryLoadMap(): MapModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-maps") as MapModule;
  } catch {
    return null;
  }
}

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

/**
 * 180-pt tall map preview centered on a place, with a marker pin and a
 * translucent circle at the geofence radius. Non-interactive in v1 — the user
 * picks the address via autocomplete, then sees what the geofence will
 * actually cover.
 *
 * Graceful degradation: when `react-native-maps` fails to load (Expo Go,
 * Jest, a hypothetical platform where the module is absent), we render an
 * info-tone Banner explaining the preview is available in a dev build so
 * developers don't hit a white square. Production managed builds bundle the
 * module and see the real map.
 */
export function MapPreview({ latitude, longitude, radiusM, color, testID }: MapPreviewProps) {
  const t = useTheme();
  const Maps = React.useMemo(() => tryLoadMap(), []);

  if (!Maps) {
    return (
      <View testID={testID}>
        <Banner
          tone="info"
          title={i18n.t("addPlace.map.unavailable")}
          testID={testID ? `${testID}-fallback` : undefined}
        />
      </View>
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
      style={{
        height: 180,
        borderRadius: t.radius.md,
        overflow: "hidden",
        backgroundColor: t.color("color.surface2"),
      }}
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
