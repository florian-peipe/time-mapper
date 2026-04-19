import React, { useEffect, useRef, useState } from "react";
import { Animated, AccessibilityInfo, Easing } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = {
  size?: number;
  testID?: string;
};

/**
 * Pulsing green dot used to indicate "currently tracking" state.
 *
 * Implementation note: uses RN's built-in Animated rather than
 * react-native-reanimated. Reanimated would buy us little here (single
 * looping opacity tween, no gestures, no JSI bridge benefits) while costing
 * extra Babel/Jest setup. If a future component needs reanimated for
 * gesture-driven motion, we can migrate this then.
 *
 * Reduce-Motion: motion is replaced with a static dot when AccessibilityInfo
 * reports reduce-motion enabled.
 */
export function TrackingDot({ size = 8, testID }: Props) {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {
        // Some platforms (older Android) reject; fall back to animated.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      testID={testID}
      accessibilityLabel="Tracking active"
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.pill,
        backgroundColor: t.color("color.success"),
        opacity: reduceMotion ? 1 : opacity,
      }}
    />
  );
}
