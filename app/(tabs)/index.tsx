import React from "react";
import { Text, View } from "react-native";
import { ScreenShell, Rings } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

export default function Timeline() {
  const t = useTheme();
  return (
    <ScreenShell>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: t.space[4],
        }}
      >
        <Rings size={t.space[10] * 6} opacity={0.07} />
        <Text
          style={{
            color: t.color("color.fg3"),
            fontSize: t.type.size.body,
            fontFamily: t.type.family.sans,
            textAlign: "center",
          }}
        >
          {i18n.t("timeline.empty.title")}
        </Text>
      </View>
    </ScreenShell>
  );
}
