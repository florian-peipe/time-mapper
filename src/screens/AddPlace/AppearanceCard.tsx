import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { PLACE_COLORS } from "@/theme/tokens";
import { i18n } from "@/lib/i18n";
import { ColorSwatch } from "./ColorSwatch";
import { IconTile } from "./IconTile";
import { ICON_CHOICES } from "./usePlaceForm";

/**
 * Color swatch row + icon-grid — the "how the place looks" slice of Phase-2.
 * Returned as a Fragment so the parent column's gap applies between the two
 * labeled sections directly, matching the original inline layout one-for-one.
 */
export function AppearanceCard({
  colorIdx,
  onChangeColorIdx,
  iconIdx,
  onChangeIconIdx,
  chosenColor,
}: {
  colorIdx: number;
  onChangeColorIdx: (v: number) => void;
  iconIdx: number;
  onChangeIconIdx: (v: number) => void;
  /** Fill color used on the selected IconTile. */
  chosenColor: string;
}) {
  const t = useTheme();
  return (
    <>
      {/* Color picker. */}
      <View>
        <Text
          accessibilityRole="text"
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
            marginBottom: t.space[2],
          }}
        >
          {i18n.t("addPlace.field.color")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: t.space[2] + 2,
            flexWrap: "wrap",
          }}
        >
          {PLACE_COLORS.map((c, i) => (
            <ColorSwatch
              key={c}
              color={c}
              selected={i === colorIdx}
              onPress={() => onChangeColorIdx(i)}
              testID={`add-place-color-${i}`}
            />
          ))}
        </View>
      </View>

      {/* Icon picker grid (6 per row). */}
      <View>
        <Text
          accessibilityRole="text"
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
            marginBottom: t.space[2],
          }}
        >
          {i18n.t("addPlace.field.icon")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: t.space[2],
          }}
        >
          {ICON_CHOICES.map((iconName, i) => (
            <IconTile
              key={iconName}
              name={iconName}
              selected={i === iconIdx}
              color={chosenColor}
              onPress={() => onChangeIconIdx(i)}
              testID={`add-place-icon-${i}`}
            />
          ))}
        </View>
      </View>
    </>
  );
}
