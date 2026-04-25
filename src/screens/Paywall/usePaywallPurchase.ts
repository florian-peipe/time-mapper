import { useCallback, useEffect, useState } from "react";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { addBreadcrumb, captureException } from "@/lib/crash";
import { i18n } from "@/lib/i18n";
import { useSheetStore } from "@/state/sheetStore";
import type { PaywallMode, PaywallSource } from "@/state/sheetStore";
import {
  getOfferings,
  isProActive,
  purchasePackage,
  restorePurchases,
} from "@/features/billing/revenuecat";
import { usePro } from "@/features/billing/usePro";
import { Platform } from "react-native";

type LoadedPackages = {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
};

type PurchaseState = "idle" | "processing" | "restoring";

type Opts = {
  visible: boolean;
  mode: PaywallMode;
  paywallSource: PaywallSource | undefined;
  currentProductId: string | undefined;
  onClose: () => void;
};

export function usePaywallPurchase({ visible, mode, paywallSource, currentProductId, onClose }: Opts) {
  const store = useSheetStore;
  const { isPro } = usePro();
  const isChangeMode = mode === "change";

  const [pkgs, setPkgs] = useState<LoadedPackages | null>(null);
  const [selected, setSelected] = useState<"monthly" | "annual">("annual");
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);
  const [offeringsError, setOfferingsError] = useState(false);

  const loadOfferings = useCallback(() => {
    setPkgs(null);
    setOfferingsError(false);
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
          const isCurrentlyMonthly =
            currentProductId === offering.monthly?.product.identifier;
          setSelected(isCurrentlyMonthly ? "annual" : "monthly");
        }
      })
      .catch((err: unknown) => {
        captureException(err, { scope: "PaywallSheet.getOfferings" });
        setOfferingsError(true);
      });
  }, [isChangeMode, currentProductId]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setPurchaseState("idle");
    setRestoreDone(false);
    loadOfferings();
  }, [visible, loadOfferings]);

  const selectedPkg: PurchasesPackage | null =
    pkgs ? (selected === "annual" ? pkgs.annual : pkgs.monthly) : null;

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

  useEffect(() => {
    if (!visible || !isPro) return;
    const pending = store.getState().pendingPlaceForm;
    if (!pending) return;
    resumeAddPlace();
  }, [isPro, visible, resumeAddPlace, store]);

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
      if (!isChangeMode && store.getState().pendingPlaceForm) {
        resumeAddPlace();
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const cancelled = (err as Record<string, unknown>).userCancelled === true;
      if (!cancelled) {
        setError(i18n.t("paywall.error.generic"));
        captureException(err, { scope: "PaywallSheet.purchase", source: paywallSource });
      }
      setPurchaseState("idle");
    }
  }, [selectedPkg, purchaseState, paywallSource, selected, onClose, resumeAddPlace, isChangeMode, currentProductId, store]);

  const handleRestore = useCallback(async () => {
    if (purchaseState !== "idle") return;
    setPurchaseState("restoring");
    setError(null);
    setRestoreDone(false);
    try {
      const info = await restorePurchases();
      if (isProActive(info)) {
        if (store.getState().pendingPlaceForm) {
          resumeAddPlace();
        } else {
          onClose();
        }
      } else {
        setRestoreDone(true);
      }
    } catch (err: unknown) {
      captureException(err, { scope: "PaywallSheet.restore", source: paywallSource });
    } finally {
      setPurchaseState("idle");
    }
  }, [purchaseState, paywallSource, onClose, resumeAddPlace, store]);

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

  return {
    pkgs,
    selected,
    setSelected,
    purchaseState,
    error,
    restoreDone,
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
  };
}
