import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fab, Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";
import { usePlaces } from "@/features/places/usePlaces";
import { useSheetStore } from "@/state/sheetStore";
import { isNativeMapUsable } from "@/lib/nativeMaps";
import type { IconName } from "@/components";
import { PlacesMapView } from "./PlacesMapView";
import { PlacesListView } from "./PlacesListView";
import { PlacesEmptyState } from "./PlacesEmptyState";

type ViewMode = "map" | "list";

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

  const mapOk = isNativeMapUsable();
  // Force list when the native map can't render (Android without a Maps SDK
  // key). The toggle hides in that case too, so the user isn't stuck on a
  // dead option.
  const effectiveMode: ViewMode = !mapOk ? "list" : mode;

  return (
    <View style={{ flex: 1, backgroundColor: t.color("color.bg") }}>
      <Header mode={effectiveMode} onSetMode={setMode} canToggle={mapOk} topInset={insets.top} />

      {places.length === 0 ? (
        <PlacesEmptyState onAdd={handleAdd} />
      ) : effectiveMode === "map" ? (
        <PlacesMapView places={places} onPressPlace={handleEdit} />
      ) : (
        <PlacesListView places={places} onPressPlace={handleEdit} />
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
  mode: ViewMode;
  onSetMode: (m: ViewMode) => void;
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
