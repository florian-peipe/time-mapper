import React from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

/**
 * Round color swatch used in the AddPlaceSheet palette picker. Selected
 * swatch gets a `fg`-tone ring outside a `bg`-tone gap, giving the
 * colored inner disc a visible "halo".
 */
export function ColorSwatch({
  color,
  selected,
  onPress,
  testID,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${i18n.t("addPlace.field.color")} ${color}`}
      accessibilityState={{ selected }}
      hitSlop={t.space[1]}
      style={{
        width: 46,
        height: 46,
        borderRadius: t.radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? t.color("color.fg") : "transparent",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: t.radius.pill,
          backgroundColor: t.color("color.bg"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: t.radius.pill,
            backgroundColor: color,
          }}
        />
      </View>
    </Pressable>
  );
}
