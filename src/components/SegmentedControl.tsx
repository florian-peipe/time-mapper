import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { useTheme } from "@/theme/useTheme";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  testID?: string;
};

/**
 * Two- or three-value toggle. Animation uses the base 200ms duration + standard
 * easing from `tokens.motion`.
 *
 * Implementation: animated thumb slides left/right over the surface2
 * background. Reduce Motion is not applied here — the thumb motion is short
 * and subtle (Reduce Motion is reserved for the signature ring pulse).
 */
export function SegmentedControl<T extends string>({ value, onChange, options, testID }: Props<T>) {
  const t = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? trackWidth / options.length : 0;

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const thumbX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (segmentWidth === 0) return;
    Animated.timing(thumbX, {
      toValue: selectedIndex * segmentWidth,
      duration: t.motion.duration.base,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, segmentWidth, thumbX, t.motion.duration.base]);

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const padding = 4;

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      onLayout={onLayout}
      style={{
        flexDirection: "row",
        backgroundColor: t.color("color.surface2"),
        borderRadius: t.radius.pill,
        padding,
        position: "relative",
      }}
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: padding,
            left: padding,
            width: segmentWidth - padding * 2,
            height: "100%",
            transform: [{ translateX: thumbX }],
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: t.color("color.surface"),
              borderRadius: t.radius.pill,
              // shadow-sm — subtle lift on the thumb.
              shadowColor: t.color("color.shadow"),
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 2,
              elevation: 1,
              // center vertically relative to the track padding
              marginVertical: -padding,
              marginTop: 0,
              height: undefined,
            }}
          />
        </Animated.View>
      )}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={{
              flex: 1,
              paddingVertical: t.space[2],
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            <Text
              style={{
                color: selected ? t.color("color.fg") : t.color("color.fg2"),
                fontSize: t.type.size.s,
                fontWeight: selected ? t.type.weight.semibold : t.type.weight.medium,
                fontFamily: t.type.family.sans,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
