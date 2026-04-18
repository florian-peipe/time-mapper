import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/theme/useTheme";

export type SourceKind = "auto" | "manual";

type Props = {
  kind: SourceKind;
  /** Localized label override (e.g. for German). Defaults to AUTO/MANUAL. */
  label?: string;
};

export function SourceChip({ kind, label }: Props) {
  const t = useTheme();
  const bg = kind === "auto" ? t.color("color.chip.auto.bg") : t.color("color.chip.manual.bg");
  const fg = kind === "auto" ? t.color("color.chip.auto.fg") : t.color("color.chip.manual.fg");
  const text = label ?? (kind === "auto" ? "AUTO" : "MANUAL");

  return (
    <View
      style={{
        paddingHorizontal: t.space[2],
        paddingVertical: 2,
        borderRadius: t.radius.pill,
        backgroundColor: bg,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: t.type.size.xs,
          fontWeight: t.type.weight.bold,
          fontFamily: t.type.family.sans,
          letterSpacing: 0.4,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
