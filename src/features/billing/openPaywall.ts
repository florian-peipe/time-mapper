import { useSnackbarStore } from "@/state/snackbarStore";
import { useSheetStore } from "@/state/sheetStore";
import { bumpCounterSafely } from "@/features/diagnostics/counters";
import { captureException } from "@/lib/crash";
import { i18n } from "@/lib/i18n";
import { isMockMode, PAYWALL_RESULT, presentPaywall } from "./revenuecat";

/** Where the paywall was opened from — logged to Sentry breadcrumbs + analytics. */
export type PaywallSource = "2nd-place" | "export" | "history" | "settings";

/**
 * Unified entry point for every paywall trigger. Two paths:
 *
 * - **Real mode** (RC keys present): presents the RevenueCat-hosted paywall
 *   via `react-native-purchases-ui`. Layout, copy, A/B variants come from
 *   the dashboard — shipped without a rebuild. If the user purchases or
 *   restores while mid-way through an AddPlace flow (tracked via
 *   `pendingPlaceForm`), the AddPlace sheet re-opens so they can finish
 *   saving the interrupted place.
 *
 * - **Mock mode** (no keys): surface a snackbar pointing contributors at
 *   the Dev-settings Pro toggle, so no-keys development flows aren't
 *   silently broken.
 *
 * Fire-and-forget — callers don't need to `await`. Pro state flows back
 * through the reactive `usePro()` hook once the SDK publishes an
 * entitlement update.
 */
export function openPaywall(opts: { source: PaywallSource }): void {
  bumpCounterSafely("paywall_shown");

  if (isMockMode()) {
    useSnackbarStore.getState().show({
      message: i18n.t("paywall.mockMode"),
      ttlMs: 5000,
    });
    return;
  }

  // Real mode — async fire-and-forget. Errors bubble to Sentry so we don't
  // silently swallow paywall presentation failures (e.g. offering missing).
  void (async () => {
    try {
      const result = await presentPaywall();
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
