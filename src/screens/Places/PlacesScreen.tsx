import React, { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, Button, Fab, Icon, Rings } from "@/components";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import type { IconName } from "@/components";
import type { Place } from "@/db/schema";

/**
 * Dedicated Places tab. Replaces the "Places" section that used to live in
 * Settings.
 *
 * Default view is a map with every saved place as a colored pin; a toggle
 * in the top-right flips to a table/list view. Tap a pin (or a list row)
 * to edit the place. Bottom-right FAB opens the AddPlaceSheet in new-place
 * mode.
 *
 * iOS uses Apple Maps natively — no key. Android needs the Google Maps SDK
 * key in app.json → android.config.googleMaps.apiKey; without it, the map
 * view is unavailable so we force the list view.
 */
export function PlacesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { places } = usePlaces();
  const openSheet = useSheetStore((s) => s.openSheet);
  const [mode, setMode] = useState<"map" | "list">("map");

  const handleAdd = useCallback(() => {
    openSheet("addPlace", { placeId: null, source: "places-tab" });
  }, [openSheet]);

  const handleEdit = useCallback(
    (placeId: string) => {
      openSheet("addPlace", { placeId, source: "places-tab" });
    },
    [openSheet],
  );

  const mapOk = isNativeMapUsable();
  const effectiveMode = !mapOk ? "list" : mode;

  return (
    <View style={{ flex: 1, backgroundColor: t.color("color.bg") }}>
      <Header mode={effectiveMode} onSetMode={setMode} canToggle={mapOk} topInset={insets.top} />

      {places.length === 0 ? (
        <EmptyState onAdd={handleAdd} />
      ) : effectiveMode === "map" ? (
        <PlacesMap places={places} onPressPlace={handleEdit} />
      ) : (
        <PlacesList places={places} onPressPlace={handleEdit} />
      )}

      {places.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: t.space[5],
            bottom: t.space[5] + insets.bottom,
          }}
        >
          <Fab
            icon="plus"
            onPress={handleAdd}
            accessibilityLabel={i18n.t("places.add")}
            testID="places-fab-add"
          />
        </View>
      ) : null}
    </View>
  );
}

function Header({
  mode,
  onSetMode,
  canToggle,
  topInset,
}: {
  mode: "map" | "list";
  onSetMode: (m: "map" | "list") => void;
  canToggle: boolean;
  topInset: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingTop: topInset + t.space[2],
        paddingHorizontal: t.space[5],
        paddingBottom: t.space[3],
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          fontSize: t.type.size.xl,
          fontWeight: t.type.weight.bold,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
          letterSpacing: -0.4,
        }}
      >
        {i18n.t("places.title")}
      </Text>
      {canToggle ? (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: t.color("color.surface2"),
            borderRadius: t.radius.pill,
            padding: 2,
          }}
        >
          <ModeToggleButton
            active={mode === "map"}
            icon="map-pin"
            label={i18n.t("places.toggle.map")}
            onPress={() => onSetMode("map")}
            testID="places-toggle-map"
          />
          <ModeToggleButton
            active={mode === "list"}
            icon="list"
            label={i18n.t("places.toggle.list")}
            onPress={() => onSetMode("list")}
            testID="places-toggle-list"
          />
        </View>
      ) : null}
    </View>
  );
}

function ModeToggleButton({
  active,
  icon,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      testID={testID}
      style={{
        paddingHorizontal: t.space[3],
        paddingVertical: t.space[1] + 2,
        borderRadius: t.radius.pill,
        backgroundColor: active ? t.color("color.surface") : "transparent",
        flexDirection: "row",
        gap: t.space[1] + 2,
        alignItems: "center",
      }}
    >
      <Icon name={icon} size={14} color={active ? t.color("color.fg") : t.color("color.fg3")} />
    </Pressable>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
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

// ----- Map view -----

type MapModule = {
  default: React.ComponentType<Record<string, unknown>>;
  Marker: React.ComponentType<Record<string, unknown>>;
  Circle: React.ComponentType<Record<string, unknown>>;
};

function tryLoadMap(): MapModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-maps") as MapModule;
  } catch {
    return null;
  }
}

function isNativeMapUsable(): boolean {
  if (Platform.OS !== "android") return true;
  const cfg = Constants.expoConfig?.android?.config as
    | { googleMaps?: { apiKey?: unknown } }
    | undefined;
  const key = cfg?.googleMaps?.apiKey;
  return typeof key === "string" && key.length > 0;
}

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

function PlacesMap({
  places,
  onPressPlace,
}: {
  places: Place[];
  onPressPlace: (placeId: string) => void;
}) {
  const t = useTheme();
  const Maps = React.useMemo(() => tryLoadMap(), []);
  const region = useMemo(() => regionCoveringAll(places), [places]);

  if (!Maps) {
    return (
      <View style={{ padding: t.space[5] }}>
        <Banner tone="warning" title={i18n.t("addPlace.map.unavailable")} />
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

// ----- List view -----

function PlacesList({
  places,
  onPressPlace,
}: {
  places: Place[];
  onPressPlace: (placeId: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
