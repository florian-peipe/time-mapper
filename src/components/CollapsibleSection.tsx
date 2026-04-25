import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

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

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        testID={testID ? `${testID}-toggle` : undefined}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: t.space[3],
          paddingHorizontal: t.space[4],
          backgroundColor: t.color("color.surface"),
          borderWidth: 1,
          borderColor: t.color("color.border"),
          borderRadius: t.radius.md,
          opacity: pressed ? 0.7 : 1,
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
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            marginLeft: t.space[2],
            transform: [{ rotate: expanded ? "180deg" : "0deg" }],
          }}
        >
          ›
        </Text>
      </Pressable>
      {/* Always rendered so testID lookups work; visually hidden when collapsed. */}
      <View style={{ overflow: "hidden", maxHeight: expanded ? 10000 : 0 }}>
        <View style={{ paddingTop: t.space[3] }}>{children}</View>
      </View>
    </View>
  );
}
