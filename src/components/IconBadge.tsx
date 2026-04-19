import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, type IconName } from "./Icon";

type Props = {
  icon: IconName;
  /** Background color — defaults to color.surface2. Hex allowed (place colors). */
  bg?: string;
  /** Icon stroke color — defaults to color.fg2. Hex allowed (place colors). */
  color?: string;
  /** Outer square size. Default 30 matches Settings Row badge. */
  size?: number;
  testID?: string;
};

/**
 * Small squircle wrapping an Icon. Used inside ListRow, the Settings Pro
 * upsell card, and the Stats upsell card. Default 30x30 square with `radius.sm`.
 *
 * Icon size scales with the container: ~53% of the outer square so the default
 * 30px badge renders a 16px icon.
 */
export function IconBadge({ icon, bg, color, size = 30, testID }: Props) {
  const t = useTheme();
  const bgColor = bg ?? t.color("color.surface2");
  const fgColor = color ?? t.color("color.fg2");
  const iconSize = Math.round(size * 0.53);

  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.sm,
        backgroundColor: bgColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={iconSize} color={fgColor} />
    </View>
  );
}
