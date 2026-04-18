import React from "react";
import { Text } from "react-native";
import { ScreenShell } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

export default function Settings() {
  const t = useTheme();
  return (
    <ScreenShell>
      <Text
        style={{
          color: t.color("color.fg"),
          fontSize: t.type.size.xl,
          fontWeight: t.type.weight.bold,
          fontFamily: t.type.family.sans,
        }}
      >
        {i18n.t("tabs.settings")}
      </Text>
    </ScreenShell>
  );
}
