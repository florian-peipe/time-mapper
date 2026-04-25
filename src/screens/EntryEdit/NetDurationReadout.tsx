import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { formatDurationCompact } from "@/lib/time";

type Props = {
  grossMin: number;
  pauseMin: number;
  netMin: number;
};

export function NetDurationReadout({ grossMin, pauseMin, netMin }: Props) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", marginBottom: t.space[5] }}>
      <Text
        style={{
          fontSize: t.type.size.xs,
          color: t.color("color.fg3"),
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.bold,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {i18n.t("entryEdit.label.netDuration")}
      </Text>
      <Text
        testID="entry-edit-net"
        style={{
          fontSize: 44,
          fontWeight: t.type.weight.bold,
          letterSpacing: -1,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
          fontVariant: ["tabular-nums"],
          marginTop: 2,
        }}
      >
        {formatDurationCompact(netMin * 60)}
      </Text>
      <Text
        style={{
          fontSize: t.type.size.s,
          color: t.color("color.fg3"),
          fontFamily: t.type.family.sans,
          fontVariant: ["tabular-nums"],
          marginTop: t.space[1],
        }}
      >
        {i18n.t("entryEdit.label.grossAndBreak", {
          gross: formatDurationCompact(grossMin * 60),
          pause: pauseMin,
        })}
      </Text>
    </View>
  );
}
