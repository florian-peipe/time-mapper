import React from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

/**
 * Per-place buffer slider row — label + current minutes readout + a slider.
 * The `visible` prop remounts the native iOS UISlider so its thumb position
 * reflects the current `minutes` value when the sheet reopens (known RN
 * Slider bug where the initial position is wrong on remount).
 */
export function BufferSliderRow({
  label,
  minutes,
  minValue,
  maxValue,
  onChange,
  testID,
  visible,
}: {
  label: string;
  minutes: number;
  minValue: number;
  maxValue: number;
  onChange: (v: number) => void;
  testID?: string;
  visible: boolean;
}) {
  const t = useTheme();
  const valueLabel = i18n.t("addPlace.field.bufferValue", { n: minutes });
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: t.space[2],
        }}
      >
        <Text
          accessibilityRole="text"
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            fontVariant: ["tabular-nums"],
          }}
          testID={testID ? `${testID}-value` : undefined}
        >
          {valueLabel}
        </Text>
      </View>
      <Slider
        key={visible ? "open" : "closed"}
        testID={testID}
        minimumValue={minValue}
        maximumValue={maxValue}
        step={1}
        value={minutes}
        onValueChange={(v: number) => onChange(Math.round(v))}
        minimumTrackTintColor={t.color("color.accent")}
        maximumTrackTintColor={t.color("color.border")}
        thumbTintColor={t.color("color.accent")}
        style={{ width: "100%", height: 28 }}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: minValue, max: maxValue, now: minutes, text: valueLabel }}
      />
    </View>
  );
}
