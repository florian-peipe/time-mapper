import { useSheetStore } from "@/state/sheetStore";
import type { PaywallSource } from "@/state/sheetStore";
import { useSnackbarStore } from "@/state/snackbarStore";
import { i18n } from "@/lib/i18n";
import { addBreadcrumb, captureException } from "@/lib/crash";
import { getOfferings } from "./revenuecat";

export type { PaywallSource } from "@/state/sheetStore";

/**
 * Open the paywall sheet in plan-change mode. The sheet renders only the
 * *other* package card and forwards the current product id as Android
 * `googleProductChangeInfo` so Play Store applies proper proration.
 *
 * Same offering prefetch + snackbar fallback as `openPaywall`.
 */
export function openPlanChange(opts: { source: PaywallSource; currentProductId: string }): void {
  addBreadcrumb({
    category: "paywall",
    message: "plan-change-open",
    level: "info",
    data: { source: opts.source, currentProductId: opts.currentProductId },
  });

  void (async () => {
    try {
      const offering = await getOfferings();
      if (!offering) {
        addBreadcrumb({
          category: "paywall",
          message: "plan-change-offering-missing",
          level: "warning",
          data: { source: opts.source },
        });
        useSnackbarStore.getState().show({
          message: i18n.t("paywall.error.pricingNotLoaded"),
          action: {
            label: i18n.t("common.retry"),
            onPress: () => openPlanChange(opts),
          },
        });
        return;
      }
      useSheetStore.getState().openSheet("paywall", {
        paywallSource: opts.source,
        mode: "change",
        currentProductId: opts.currentProductId,
      });
    } catch (err) {
      captureException(err, { scope: "openPlanChange", source: opts.source });
    }
  })();
}

/**
 * Unified entry point for every paywall trigger. Opens the in-app
 * `PaywallSheet` which fetches packages, lets the user pick monthly/annual,
 * and calls RC `purchasePackage` directly — no dependency on a dashboard-
 * configured hosted paywall.
 *
 * If the offering hasn't loaded yet (store unreachable, dashboard misconfig,
 * cold-start race), shows a snackbar with a Retry action instead of opening
 * an empty sheet. The retry re-invokes with the same source so breadcrumbs
 * stay aligned.
 *
 * Fire-and-forget — callers don't need to `await`. Pro state flows back
 * through the reactive `usePro()` hook once the SDK publishes an entitlement
 * update. Post-purchase AddPlace resumption is handled inside `PaywallSheet`
 * via the `pendingPlaceForm` slot in the sheet store.
 */
export function openPaywall(opts: { source: PaywallSource }): void {
  addBreadcrumb({
    category: "paywall",
    message: "paywall-open",
    level: "info",
    data: { source: opts.source },
  });

  void (async () => {
    try {
      const offering = await getOfferings();
      if (!offering) {
        addBreadcrumb({
          category: "paywall",
          message: "paywall-offering-missing",
          level: "warning",
          data: { source: opts.source },
        });
        useSnackbarStore.getState().show({
          message: i18n.t("paywall.error.pricingNotLoaded"),
          action: {
            label: i18n.t("common.retry"),
            onPress: () => openPaywall({ source: opts.source }),
          },
        });
        return;
      }
      useSheetStore.getState().openSheet("paywall", { paywallSource: opts.source });
    } catch (err) {
      captureException(err, { scope: "openPaywall", source: opts.source });
    }
  })();
}
