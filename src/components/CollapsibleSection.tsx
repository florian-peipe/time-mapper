import React, { useRef, useState } from "react";
import { Animated, LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "./Icon";

// LayoutAnimation requires explicit opt-in on Android.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  testID?: string;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, hint, defaultOpen = false, testID, children }: Props) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const t = useTheme();
  const chevronAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext({
      duration: t.motion.duration.base,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    Animated.timing(chevronAnim, {
      toValue: expanded ? 0 : 1,
      duration: t.motion.duration.base,
      useNativeDriver: true,
    }).start();
    setExpanded((v) => !v);
  };

  const chevronRotation = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View>
      <Pressable
        onPress={toggle}
        testID={testID ? `${testID}-toggle` : undefined}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: t.space[2],
          minHeight: t.minTouchTarget,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: t.type.size.s,
              fontWeight: t.type.weight.semibold,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
            }}
          >
            {title}
          </Text>
          {hint ? (
            <Text
              style={{
                fontSize: t.type.size.xs,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
                marginTop: 1,
              }}
            >
              {hint}
            </Text>
          ) : null}
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Icon name="chevron-down" size={16} color={t.color("color.fg3")} />
        </Animated.View>
      </Pressable>
      {expanded ? <View style={{ paddingTop: t.space[2] }}>{children}</View> : null}
    </View>
  );
}
