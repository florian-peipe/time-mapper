import React from "react";
import { Text, View } from "react-native";
import { Rings } from "@/components";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";

type Props = {
  isChangeMode: boolean;
  selected: "monthly" | "annual";
};

export function PaywallHero({ isChangeMode, selected }: Props) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.color("color.fg"),
        borderRadius: t.radius.lg,
        padding: t.space[5],
        marginBottom: t.space[5],
        overflow: "hidden",
        position: "relative",
      }}
    >
      <View pointerEvents="none" style={{ position: "absolute", top: -40, right: -40 }}>
        <Rings size={200} opacity={0.1} color={t.color("color.accent")} />
      </View>
      <Text
        style={{
          fontFamily: t.type.family.sans,
          fontSize: t.type.size.xl,
          fontWeight: t.type.weight.bold,
          color: t.color("color.bg"),
          lineHeight: t.type.size.xl * 1.25,
        }}
      >
        {isChangeMode
          ? i18n.t(selected === "annual" ? "paywall.change.title.toAnnual" : "paywall.change.title.toMonthly")
          : i18n.t("paywall.hero.title")}
      </Text>
      <Text
        style={{
          fontFamily: t.type.family.sans,
          fontSize: t.type.size.s,
          color: t.color("color.bg"),
          opacity: 0.75,
          marginTop: t.space[2],
        }}
      >
        {isChangeMode
          ? i18n.t(
              selected === "annual"
                ? "paywall.change.body.toAnnual"
                : "paywall.change.body.toMonthly",
            )
          : i18n.t("paywall.hero.body")}
      </Text>
    </View>
  );
}
