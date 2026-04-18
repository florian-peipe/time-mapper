import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, type IconName } from "./Icon";

type Props = {
  icon: IconName;
  /** Place color (from PLACE_COLORS or a categorical hex). */
  color: string;
  size?: number;
  testID?: string;
};

export function PlaceBubble({ icon, color, size = 42, testID }: Props) {
  const t = useTheme();
  const iconSize = Math.round(size * 0.46);
  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.pill,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={iconSize} color={t.color("color.accent.contrast")} />
    </View>
  );
}
