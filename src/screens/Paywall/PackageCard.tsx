import React from "react";
import { Pressable, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { i18n } from "@/lib/i18n";
import { useTheme } from "@/theme/useTheme";

type IntroPrice = { price: number; periodNumberOfUnits: number };

type Props = {
  side: "monthly" | "annual";
  pkg: PurchasesPackage;
  isSelected: boolean;
  onSelect: () => void;
  savingsPercent: number;
  annualTrial: IntroPrice | null;
  isChangeMode: boolean;
};

export function PackageCard({
  side,
  pkg,
  isSelected,
  onSelect,
  savingsPercent,
  annualTrial,
  isChangeMode,
}: Props) {
  const t = useTheme();
  const isAnnual = side === "annual";

  const monthlyEquivalent = isAnnual
    ? formatAmount(pkg.product.price / 12, pkg.product.currencyCode)
    : null;

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={({ pressed }) => ({
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? t.color("color.accent") : t.color("color.border"),
        borderRadius: t.radius.md,
        padding: t.space[4],
        marginBottom: t.space[3],
        backgroundColor: isSelected ? t.color("color.accent.soft") : t.color("color.surface"),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <Text
          style={{
            fontFamily: t.type.family.sans,
            fontSize: t.type.size.m,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.fg"),
          }}
        >
          {isAnnual ? i18n.t("paywall.packageLabel.annual") : i18n.t("paywall.packageLabel.monthly")}
        </Text>
        {isAnnual && savingsPercent > 0 && (
          <View
            style={{
              backgroundColor: t.color("color.accent"),
              borderRadius: t.radius.pill,
              paddingHorizontal: t.space[2],
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontFamily: t.type.family.sans,
                fontSize: t.type.size.xs,
                fontWeight: t.type.weight.bold,
                color: t.color("color.accent.contrast"),
              }}
            >
              {i18n.t("paywall.savings", { percent: savingsPercent })}
            </Text>
          </View>
        )}
      </View>

      {isAnnual && monthlyEquivalent ? (
        <>
          <Text
            style={{
              fontFamily: t.type.family.sans,
              fontSize: t.type.size.l,
              fontWeight: t.type.weight.bold,
              color: t.color("color.fg"),
              marginTop: t.space[1],
            }}
          >
            {monthlyEquivalent}
            <Text
              style={{
                fontSize: t.type.size.s,
                fontWeight: t.type.weight.regular,
                color: t.color("color.fg2"),
              }}
            >
              {" "}
              {i18n.t("paywall.period.month")}
            </Text>
          </Text>
          <Text
            style={{
              fontFamily: t.type.family.sans,
              fontSize: t.type.size.xs,
              color: t.color("color.fg2"),
              marginTop: 2,
            }}
          >
            {i18n.t("paywall.billing.annual", { price: pkg.product.priceString })}
          </Text>
        </>
      ) : (
        <Text
          style={{
            fontFamily: t.type.family.sans,
            fontSize: t.type.size.l,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            marginTop: t.space[1],
          }}
        >
          {pkg.product.priceString}
          <Text
            style={{
              fontSize: t.type.size.s,
              fontWeight: t.type.weight.regular,
              color: t.color("color.fg2"),
            }}
          >
            {" "}
            {i18n.t("paywall.period.month")}
          </Text>
        </Text>
      )}

      {isAnnual && annualTrial && !isChangeMode && (
        <View style={{ flexDirection: "row", marginTop: t.space[2] }}>
          <View
            style={{
              backgroundColor: t.color("color.success.soft"),
              borderRadius: t.radius.pill,
              paddingHorizontal: t.space[2],
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontFamily: t.type.family.sans,
                fontSize: t.type.size.xs,
                fontWeight: t.type.weight.semibold,
                color: t.color("color.success"),
              }}
            >
              {i18n.t("paywall.trial.badge", { days: annualTrial.periodNumberOfUnits })}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function formatAmount(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}
