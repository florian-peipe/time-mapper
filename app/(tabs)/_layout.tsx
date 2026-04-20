import React from "react";
import { Tabs } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { Icon } from "@/components";

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.color("color.accent"),
        tabBarInactiveTintColor: t.color("color.fg3"),
        tabBarStyle: {
          backgroundColor: t.color("color.surface"),
          borderTopColor: t.color("color.border"),
          paddingTop: t.space[2],
          height: t.space[14] + t.space[2],
        },
        tabBarLabelStyle: {
          fontFamily: t.type.family.sans,
          // Four tabs on a 375pt iPhone 13 mini only leaves ~94pt per tab —
          // the German "Einstellungen" (13 chars) ellipsises at xs/semibold.
          // Drop a touch and use medium weight so every label fits cleanly.
          fontSize: 10,
          fontWeight: t.type.weight.medium,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: i18n.t("tabs.timeline"),
          tabBarIcon: ({ color, size }) => <Icon name="clock" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: i18n.t("tabs.places"),
          tabBarIcon: ({ color, size }) => <Icon name="map-pin" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: i18n.t("tabs.stats"),
          tabBarIcon: ({ color, size }) => <Icon name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: i18n.t("tabs.settings"),
          tabBarIcon: ({ color, size }) => <Icon name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
