import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

export type MapListToggleMode = "map" | "list";

export type MapListToggleProps = {
  mode: MapListToggleMode;
  onSetMode: (next: MapListToggleMode) => void;
  testIDPrefix?: string;
};

/**
 * Two-segment pill toggle switching between Map and List view on the Places
 * tab. Extracted from the inline `ModeToggleButton` in `PlacesScreen` and
 * extended with visible labels so the control is discoverable.
 *
 * Reuses the same token set as the original: `surface2` track, `surface`
 * active chip, `fg` / `fg3` icon + text colors.
 */
export function MapListToggle({ mode, onSetMode, testIDPrefix = "places" }: MapListToggleProps) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.color("color.surface2"),
        borderRadius: t.radius.pill,
        padding: 2,
      }}
    >
      <ToggleSegment
        active={mode === "map"}
        icon="map-pin"
        label={i18n.t("places.toggle.map")}
        onPress={() => onSetMode("map")}
        testID={`${testIDPrefix}-toggle-map`}
      />
      <ToggleSegment
        active={mode === "list"}
        icon="list"
        label={i18n.t("places.toggle.list")}
        onPress={() => onSetMode("list")}
        testID={`${testIDPrefix}-toggle-list`}
      />
    </View>
  );
}

function ToggleSegment({
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
  const fg = active ? t.color("color.fg") : t.color("color.fg3");
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
      <Icon name={icon} size={13} color={fg} />
      <Text
        style={{
          fontSize: t.type.size.xs + 1,
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.medium,
          color: fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
