import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";

const BASE = "https://florian-peipe.github.io/time-mapper";
function legalUrl(page: "terms" | "privacy"): string {
  const lang = i18n.locale.startsWith("de") ? "de" : "en";
  return `${BASE}/${page}-${lang}.html`;
}

type Props = {
  error: string | null;
  ctaLabel: string;
  restoreLabel: string;
  purchaseState: "idle" | "processing" | "restoring";
  selectedPkg: PurchasesPackage | null;
  handlePurchase: () => void;
  handleRestore: () => void;
};

export function PaywallCTAFooter({
  error,
  ctaLabel,
  restoreLabel,
  purchaseState,
  selectedPkg,
  handlePurchase,
  handleRestore,
}: Props) {
  const t = useTheme();
  return (
    <>
      {error ? (
        <Text
          style={{
            fontFamily: t.type.family.sans,
            fontSize: t.type.size.xs,
            color: t.color("color.danger"),
            textAlign: "center",
            marginBottom: t.space[2],
          }}
        >
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="paywall-buy"
        onPress={handlePurchase}
        disabled={purchaseState !== "idle" || !selectedPkg}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        style={({ pressed }) => ({
          backgroundColor: t.color("color.accent"),
          borderRadius: t.radius.pill,
          paddingVertical: t.space[3] + 2,
          alignItems: "center",
          opacity: pressed || purchaseState !== "idle" || !selectedPkg ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            fontFamily: t.type.family.sans,
            fontSize: t.type.size.m,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.accent.contrast"),
          }}
        >
          {ctaLabel}
        </Text>
      </Pressable>
      <Pressable
        testID="paywall-restore"
        onPress={handleRestore}
        disabled={purchaseState !== "idle"}
        accessibilityRole="button"
        style={{ alignItems: "center", paddingVertical: t.space[3] }}
      >
        <Text
          style={{
            fontFamily: t.type.family.sans,
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
          }}
        >
          {restoreLabel}
        </Text>
      </Pressable>
    </>
  );
}

export function PaywallLegalLinks() {
  const t = useTheme();
  return (
    <>
      <Text
        style={{
          fontFamily: t.type.family.sans,
          fontSize: t.type.size.xs,
          color: t.color("color.fg3"),
          textAlign: "center",
          marginTop: t.space[3],
          lineHeight: t.type.size.xs * 1.6,
        }}
      >
        {i18n.t("paywall.disclaimer")}
      </Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: t.space[4],
          marginTop: t.space[3],
        }}
      >
        <Pressable
          onPress={() => void Linking.openURL(legalUrl("terms"))}
          accessibilityRole="link"
        >
          <Text
            style={{
              fontFamily: t.type.family.sans,
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              textDecorationLine: "underline",
            }}
          >
            {i18n.t("paywall.footer.terms")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(legalUrl("privacy"))}
          accessibilityRole="link"
        >
          <Text
            style={{
              fontFamily: t.type.family.sans,
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              textDecorationLine: "underline",
            }}
          >
            {i18n.t("paywall.footer.privacy")}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
