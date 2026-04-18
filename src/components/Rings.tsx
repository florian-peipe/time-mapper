import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "@/theme/useTheme";

type Props = {
  size?: number;
  /** 0..1, default 0.08 per design-system. */
  opacity?: number;
  /** Stroke color override. Defaults to theme accent. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Concentric-ring decoration — Time Mapper's signature visual motif (the
 * geofence radius). Used as background art on empty states and the
 * onboarding hero. Source: design-system Components.jsx Rings.
 */
export function Rings({ size = 180, opacity = 0.08, color, style, testID }: Props) {
  const t = useTheme();
  const stroke = color ?? t.color("color.accent");
  return (
    <View testID={testID} style={[{ width: size, height: size, opacity }, style]}>
      <Svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
        <G stroke={stroke} strokeWidth={0.8}>
          <Circle cx={50} cy={50} r={16} />
          <Circle cx={50} cy={50} r={28} />
          <Circle cx={50} cy={50} r={40} />
          <Circle cx={50} cy={50} r={48} />
        </G>
      </Svg>
    </View>
  );
}
