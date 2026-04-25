import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Sheet } from "@/components/Sheet";
import { i18n } from "@/lib/i18n";
import type { PaywallMode, PaywallSource } from "@/state/sheetStore";
import { useTheme } from "@/theme/useTheme";
import { PackageCard } from "./PackageCard";
import { PaywallHero } from "./PaywallHero";
import { PaywallFeaturesList } from "./PaywallFeaturesList";
import { PaywallCTAFooter, PaywallLegalLinks } from "./PaywallFooter";
import { usePaywallPurchase } from "./usePaywallPurchase";

type Props = {
  visible: boolean;
  paywallSource: PaywallSource | undefined;
  /** "subscribe" (default) shows both package cards. "change" shows only the target card. */
  mode?: PaywallMode;
  /** Current store product id — forwarded as Android googleProductChangeInfo when mode="change". */
  currentProductId?: string;
  onClose: () => void;
};

export function PaywallSheet({ visible, paywallSource, mode = "subscribe", currentProductId, onClose }: Props) {
  const t = useTheme();

  const {
    pkgs,
    selected,
    setSelected,
    purchaseState,
    error,
    offeringsError,
    loadOfferings,
    selectedPkg,
    annualTrial,
    savingsPercent,
    isChangeMode,
    ctaLabel,
    restoreLabel,
    handlePurchase,
    handleRestore,
  } = usePaywallPurchase({ visible, mode, paywallSource, currentProductId, onClose });

  const footer = (
    <PaywallCTAFooter
      error={error}
      ctaLabel={ctaLabel}
      restoreLabel={restoreLabel}
      purchaseState={purchaseState}
      selectedPkg={selectedPkg}
      handlePurchase={handlePurchase}
      handleRestore={handleRestore}
    />
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={92}
      title="Time Mapper Pro"
      footer={footer}
    >
      {!pkgs ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: t.space[10],
          }}
        >
          {offeringsError ? (
            <>
              <Text
                style={{
                  fontFamily: t.type.family.sans,
                  fontSize: t.type.size.s,
                  color: t.color("color.fg2"),
                  textAlign: "center",
                  marginBottom: t.space[4],
                }}
              >
                {i18n.t("paywall.error.pricingNotLoaded")}
              </Text>
              <Pressable
                onPress={loadOfferings}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  backgroundColor: t.color("color.accent"),
                  borderRadius: t.radius.pill,
                  paddingVertical: t.space[2],
                  paddingHorizontal: t.space[5],
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: t.type.family.sans,
                    fontSize: t.type.size.s,
                    fontWeight: t.type.weight.semibold,
                    color: t.color("color.accent.contrast"),
                  }}
                >
                  {i18n.t("paywall.error.tryAgain")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator color={t.color("color.accent")} />
              <Text
                style={{
                  fontFamily: t.type.family.sans,
                  fontSize: t.type.size.s,
                  color: t.color("color.fg2"),
                  marginTop: t.space[3],
                }}
              >
                {i18n.t("paywall.loading")}
              </Text>
            </>
          )}
        </View>
      ) : (
        <>
          {/* Paused banner when an AddPlace flow is interrupted */}
          {paywallSource === "2nd-place" && (
            <View
              style={{
                backgroundColor: t.color("color.warning.soft"),
                borderRadius: t.radius.md,
                padding: t.space[4],
                marginBottom: t.space[4],
              }}
            >
              <Text
                style={{
                  fontFamily: t.type.family.sans,
                  fontSize: t.type.size.s,
                  fontWeight: t.type.weight.semibold,
                  color: t.color("color.warning"),
                }}
              >
                {i18n.t("paywall.pausedForm.title")}
              </Text>
              <Text
                style={{
                  fontFamily: t.type.family.sans,
                  fontSize: t.type.size.s,
                  color: t.color("color.fg2"),
                  marginTop: 2,
                }}
              >
                {i18n.t("paywall.pausedForm.body")}
              </Text>
            </View>
          )}

          <PaywallHero isChangeMode={isChangeMode} selected={selected} />

          <PaywallFeaturesList />

          {/* Package cards */}
          {isChangeMode ? (
            pkgs[selected] ? (
              <PackageCard
                side={selected}
                pkg={pkgs[selected]!}
                isSelected
                onSelect={() => {}}
                savingsPercent={savingsPercent}
                annualTrial={annualTrial}
                isChangeMode
                testID={`paywall-package-${pkgs[selected]!.product.identifier}`}
              />
            ) : null
          ) : (
            <>
              {pkgs.annual && (
                <PackageCard
                  side="annual"
                  pkg={pkgs.annual}
                  isSelected={selected === "annual"}
                  onSelect={() => setSelected("annual")}
                  savingsPercent={savingsPercent}
                  annualTrial={annualTrial}
                  isChangeMode={false}
                  testID={`paywall-package-${pkgs.annual.product.identifier}`}
                />
              )}
              {pkgs.monthly && (
                <PackageCard
                  side="monthly"
                  pkg={pkgs.monthly}
                  isSelected={selected === "monthly"}
                  onSelect={() => setSelected("monthly")}
                  savingsPercent={savingsPercent}
                  annualTrial={annualTrial}
                  isChangeMode={false}
                  testID={`paywall-package-${pkgs.monthly.product.identifier}`}
                />
              )}
            </>
          )}

          <PaywallLegalLinks />
        </>
      )}
    </Sheet>
  );
}
