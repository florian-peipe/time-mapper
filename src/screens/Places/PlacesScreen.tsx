import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fab, MapListToggle } from "@/components";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import { isNativeMapUsable } from "@/lib/nativeMaps";
import { reverseGeocode } from "@/lib/geocode";
import { PlacesMapView } from "./PlacesMapView";
import { PlacesListView } from "./PlacesListView";
import { PlacesEmptyState } from "./PlacesEmptyState";

type ViewMode = "map" | "list";

/**
 * Dedicated Places tab. Default view is an edge-to-edge map with every saved
 * place as a colored pin; a floating Map/List toggle in the top-right flips
 * to a table/list view. Tap a pin (or a list row) to edit the place. Long-
 * press an empty map area to create a new place at that location (the sheet
 * opens directly in Phase 2 with the reverse-geocoded address pre-filled).
 * Bottom-right FAB opens the AddPlaceSheet in new-place mode (search-first).
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
  const [mode, setMode] = useState<ViewMode>("map");

  const handleAdd = useCallback(() => {
    openSheet("addPlace", { placeId: null, source: "places-tab" });
  }, [openSheet]);

  const handleEdit = useCallback(
    (placeId: string) => {
      openSheet("addPlace", { placeId, source: "places-tab" });
    },
    [openSheet],
  );

  const handleLongPressOnMap = useCallback(
    async (coord: { latitude: number; longitude: number }) => {
      let description: string;
      try {
        const result = await reverseGeocode(coord.latitude, coord.longitude);
        description = result.description;
      } catch {
        description = `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`;
      }
      openSheet("addPlace", {
        placeId: null,
        source: "places-tab",
        seed: { latitude: coord.latitude, longitude: coord.longitude, description },
      });
    },
    [openSheet],
  );

  // Toggle is always shown — PlacesMapView handles the no-key placeholder itself.
  // Only the long-press-to-create gesture requires a working map.
  const mapOk = isNativeMapUsable();
  const effectiveMode: ViewMode = mode;
  const showToggle = true;

  const body =
    places.length === 0 ? (
      <PlacesEmptyState onAdd={handleAdd} />
    ) : effectiveMode === "map" ? (
      <PlacesMapView
        places={places}
        onPressPlace={handleEdit}
        onLongPressMap={mapOk ? handleLongPressOnMap : undefined}
      />
    ) : (
      <PlacesListView places={places} onPressPlace={handleEdit} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.color("color.bg") }}>
      {/* List mode: visible header with title + toggle */}
      {effectiveMode === "list" ? (
        <View
          style={{
            paddingTop: insets.top + t.space[2],
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
          {showToggle ? (
            <MapListToggle mode={effectiveMode} onSetMode={setMode} />
          ) : null}
        </View>
      ) : null}

      {/* Map mode: edge-to-edge with floating toggle overlay */}
      <View style={{ flex: 1 }}>
        {body}

        {/* Floating toggle — only in map mode, only when map is usable */}
        {effectiveMode === "map" && showToggle ? (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: insets.top + t.space[2],
              right: t.space[5],
            }}
          >
            <MapListToggle mode={effectiveMode} onSetMode={setMode} />
          </View>
        ) : null}
      </View>

      {/* FAB — always available when there are places */}
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
