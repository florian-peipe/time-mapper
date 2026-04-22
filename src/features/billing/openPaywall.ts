import { useSheetStore } from "@/state/sheetStore";
import { useSnackbarStore } from "@/state/snackbarStore";
import { i18n } from "@/lib/i18n";
import { addBreadcrumb, captureException } from "@/lib/crash";
import { getOfferings, PAYWALL_RESULT, presentPaywall } from "./revenuecat";

/** Where the paywall was opened from — logged to Sentry breadcrumbs + analytics. */
export type PaywallSource = "2nd-place" | "export" | "history" | "settings";

/**
 * Unified entry point for every paywall trigger. Presents the RevenueCat-
 * hosted paywall via `react-native-purchases-ui`. Layout, copy, and A/B
 * variants come from the dashboard — shipped without a rebuild.
 *
 * If the user purchases or restores while mid-way through an AddPlace flow
 * (tracked via `pendingPlaceForm`), the AddPlace sheet re-opens so they can
 * finish saving the interrupted place.
 *
 * Fire-and-forget — callers don't need to `await`. Pro state flows back
 * through the reactive `usePro()` hook once the SDK publishes an
 * entitlement update.
 *
 * If the offering hasn't loaded yet (store unreachable, dashboard misconfig,
 * cold-start race), shows a snackbar with a Retry action instead of
 * presenting an empty RC modal. The retry re-invokes with the same source
 * so breadcrumbs + analytics stay aligned.
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
      const result = await presentPaywall(offering);
      addBreadcrumb({
        category: "paywall",
        message: "paywall-closed",
        level: "info",
        data: { source: opts.source, result },
      });
      maybeResumeAddPlace(result);
    } catch (err) {
      captureException(err, { scope: "openPaywall", source: opts.source });
    }
  })();
}

/**
 * If a paywall closed with PURCHASED / RESTORED and there's an interrupted
 * AddPlace form sitting in the sheet store, reopen the sheet so the user
 * can complete the save that triggered the upsell.
 */
function maybeResumeAddPlace(result: PAYWALL_RESULT): void {
  if (result !== PAYWALL_RESULT.PURCHASED && result !== PAYWALL_RESULT.RESTORED) return;
  const store = useSheetStore.getState();
  const pending = store.pendingPlaceForm;
  if (!pending) return;
  store.openSheet("addPlace", {
    placeId: pending.placeId,
    source: pending.source,
  });
}
