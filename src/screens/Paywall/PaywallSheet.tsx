import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import { Rings } from "@/components";
import { Sheet } from "@/components/Sheet";
import { addBreadcrumb, captureException } from "@/lib/crash";
import { i18n } from "@/lib/i18n";
import { useSheetStore } from "@/state/sheetStore";
import type { PaywallMode, PaywallSource } from "@/state/sheetStore";
import { useTheme } from "@/theme/useTheme";
import {
  getOfferings,
  isProActive,
  purchasePackage,
  restorePurchases,
} from "@/features/billing/revenuecat";

const BASE = "https://florian-peipe.github.io/time-mapper";
function legalUrl(page: "terms" | "privacy"): string {
  const lang = i18n.locale.startsWith("de") ? "de" : "en";
  return `${BASE}/${page}-${lang}.html`;
}

type Props = {
  visible: boolean;
  paywallSource: PaywallSource | undefined;
  /** "subscribe" (default) shows both package cards. "change" shows only the target card. */
  mode?: PaywallMode;
  /** Current store product id — forwarded as Android googleProductChangeInfo when mode="change". */
  currentProductId?: string;
  onClose: () => void;
};

type LoadedPackages = {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
};

type PurchaseState = "idle" | "processing" | "restoring";

export function PaywallSheet({ visible, paywallSource, mode = "subscribe", currentProductId, onClose }: Props) {
  const t = useTheme();
  const store = useSheetStore;
  const isChangeMode = mode === "change";

  const [pkgs, setPkgs] = useState<LoadedPackages | null>(null);
  const [selected, setSelected] = useState<"monthly" | "annual">("annual");
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPkgs(null);
    setError(null);
    setPurchaseState("idle");
    setRestoreDone(false);
    // In change mode the target is determined by which package isn't the current one.
    // Defer setting `selected` until packages load (see below).
    if (!isChangeMode) setSelected("annual");

    void getOfferings()
      .then((offering: PurchasesOffering | null) => {
        if (!offering) return;
        const loaded: LoadedPackages = {
          monthly: offering.monthly ?? null,
          annual: offering.annual ?? null,
        };
        setPkgs(loaded);
        if (isChangeMode && currentProductId) {
          // Auto-select the target: the package the user is NOT currently on.
          const isCurrentlyMonthly =
            currentProductId === offering.monthly?.product.identifier;
          setSelected(isCurrentlyMonthly ? "annual" : "monthly");
        }
      })
      .catch((err: unknown) => {
        captureException(err, { scope: "PaywallSheet.getOfferings" });
      });
  }, [visible, isChangeMode, currentProductId]);

  const selectedPkg: PurchasesPackage | null =
    pkgs ? (selected === "annual" ? pkgs.annual : pkgs.monthly) : null;

  // Only surface free trials (price === 0), not paid intro offers.
  const annualIntro = pkgs?.annual?.product.introPrice ?? null;
  const annualTrial = annualIntro?.price === 0 ? annualIntro : null;

  const savingsPercent: number =
    pkgs?.monthly && pkgs?.annual && pkgs.monthly.product.price > 0
      ? Math.max(
          0,
          Math.round(
            (1 - pkgs.annual.product.price / 12 / pkgs.monthly.product.price) * 100,
          ),
        )
      : 0;

  const resumeAddPlace = useCallback(() => {
    const state = store.getState();
    const pending = state.pendingPlaceForm;
    if (pending) {
      state.openSheet("addPlace", { placeId: pending.placeId, source: pending.source });
    }
  }, [store]);

  const handlePurchase = useCallback(async () => {
    if (!selectedPkg || purchaseState !== "idle") return;
    setPurchaseState("processing");
    setError(null);
    addBreadcrumb({
      category: "paywall",
      message: "purchase-start",
      level: "info",
      data: { source: paywallSource, selected },
    });
    try {
      const planChange =
        isChangeMode && currentProductId && Platform.OS === "android"
          ? { oldProductIdentifier: currentProductId }
          : undefined;
      await purchasePackage(selectedPkg, planChange);
      addBreadcrumb({
        category: "paywall",
        message: isChangeMode ? "plan-change-success" : "purchase-success",
        level: "info",
        data: isChangeMode ? { from: currentProductId, to: selectedPkg.product.identifier } : {},
      });
      onClose();
      if (!isChangeMode) resumeAddPlace();
    } catch (err: unknown) {
      const cancelled =
        (err as Record<string, unknown>).userCancelled === true;
      if (!cancelled) {
        setError(i18n.t("paywall.error.generic"));
        captureException(err, { scope: "PaywallSheet.purchase", source: paywallSource });
      }
      setPurchaseState("idle");
    }
  }, [selectedPkg, purchaseState, paywallSource, selected, onClose, resumeAddPlace, isChangeMode, currentProductId]);

  const handleRestore = useCallback(async () => {
    if (purchaseState !== "idle") return;
    setPurchaseState("restoring");
    setError(null);
    setRestoreDone(false);
    try {
      const info = await restorePurchases();
      if (isProActive(info)) {
        onClose();
        resumeAddPlace();
      } else {
        setRestoreDone(true);
      }
    } catch (err: unknown) {
      captureException(err, { scope: "PaywallSheet.restore", source: paywallSource });
    } finally {
      setPurchaseState("idle");
    }
  }, [purchaseState, paywallSource, onClose, resumeAddPlace]);

  const ctaLabel =
    purchaseState === "processing"
      ? i18n.t("paywall.cta.processing")
      : isChangeMode
        ? i18n.t(selected === "annual" ? "paywall.change.cta.toAnnual" : "paywall.change.cta.toMonthly")
        : selected === "annual" && annualTrial
          ? i18n.t("paywall.cta.freeTrial")
          : i18n.t("paywall.cta.subscribe");

  const restoreLabel =
    purchaseState === "restoring"
      ? i18n.t("paywall.restore.busy")
      : restoreDone
        ? i18n.t("paywall.restore.done")
        : i18n.t("paywall.restore.idle");

  function renderPackageCard(side: "monthly" | "annual") {
    const pkg = side === "annual" ? pkgs!.annual : pkgs!.monthly;
    if (!pkg) return null;
    const isSelected = selected === side;
    const isAnnual = side === "annual";

    const monthlyEquivalent = isAnnual
      ? formatAmount(pkg.product.price / 12, pkg.product.currencyCode)
      : null;

    return (
      <Pressable
        key={side}
        onPress={() => setSelected(side)}
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
            {isAnnual
              ? i18n.t("paywall.packageLabel.annual")
              : i18n.t("paywall.packageLabel.monthly")}
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

  const footer = (
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

          {/* Hero */}
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
            <View
              pointerEvents="none"
              style={{ position: "absolute", top: -40, right: -40 }}
            >
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

          {/* Feature list */}
          <View style={{ marginBottom: t.space[5] }}>
            {(
              [
                "paywall.features.unlimited",
                "paywall.features.history",
                "paywall.features.reports",
                "paywall.features.export",
              ] as const
            ).map((key) => (
              <View
                key={key}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: t.space[2],
                }}
              >
                <Text
                  style={{
                    color: t.color("color.success"),
                    fontSize: t.type.size.body,
                    marginRight: t.space[2],
                    lineHeight: t.type.size.body * 1.4,
                  }}
                >
                  ✓
                </Text>
                <Text
                  style={{
                    fontFamily: t.type.family.sans,
                    fontSize: t.type.size.body,
                    color: t.color("color.fg"),
                    flex: 1,
                    lineHeight: t.type.size.body * 1.4,
                  }}
                >
                  {i18n.t(key)}
                </Text>
              </View>
            ))}
          </View>

          {/* Package cards — annual first in subscribe mode; only target card in change mode */}
          {isChangeMode ? (
            renderPackageCard(selected)
          ) : (
            <>
              {renderPackageCard("annual")}
              {renderPackageCard("monthly")}
            </>
          )}

          {/* Apple / Google required disclosures */}
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

          {/* Legal links */}
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
      )}
    </Sheet>
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
