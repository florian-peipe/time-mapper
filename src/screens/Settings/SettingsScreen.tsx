import React, { useCallback, useMemo, useState } from "react";
import { Linking, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as StoreReview from "expo-store-review";
import { useTheme } from "@/theme/useTheme";
import { usePlacesRepo } from "@/features/places/usePlaces";
import { useEntriesRepo } from "@/features/entries/useEntries";
import { useLocationPermission, useNotificationPermission } from "@/features/permissions/hooks";
import { readGlobalBuffers, BuffersSheet } from "./BuffersSheet";
import { usePro } from "@/features/billing/usePro";
import { openPaywall, openPlanChange, type PaywallSource } from "@/features/billing/openPaywall";
import { presentCustomerCenter } from "@/features/billing/revenuecat";
import { useUiStore } from "@/state/uiStore";
import { i18n, setLocale } from "@/lib/i18n";
import { captureException } from "@/lib/crash";
import { legalRoute } from "@/lib/routes";
import { ProUpsellCard } from "./ProUpsellCard";
import { useKvRepo, useOnboardingGate } from "@/features/onboarding/useOnboardingGate";
import { NotificationsSheet } from "./NotificationsSheet";
import { SettingsDataSection } from "./SettingsDataSection";
import { SettingsTrackingSection } from "./SettingsTrackingSection";
import { SettingsAppearanceSection } from "./SettingsAppearanceSection";
import { SettingsSubscriptionSection } from "./SettingsSubscriptionSection";
import { SettingsAboutSection } from "./SettingsAboutSection";
import { ProChip } from "./ProChip";
import { nextTheme, nextLocale } from "./SettingsLabels";
import { useSettingsDataHandlers } from "./useSettingsDataHandlers";

/**
 * Deep-link to the platform-specific subscription management page. iOS
 * uses the `itms-apps://` scheme that opens the App Store directly into
 * the user's subscriptions list. Android opens Play Store via web URL —
 * the Play Store app intercepts and routes accordingly.
 */
const SUBSCRIPTION_MANAGEMENT_URL =
  Platform.OS === "ios"
    ? "itms-apps://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

/**
 * Fallback URL used when `StoreReview.isAvailableAsync()` returns false (rare
 * — usually only in simulators). iTunes action=write-review opens the store
 * page preloaded to the review form. User replaces the app id post-submission.
 */
const STORE_REVIEW_FALLBACK_URL =
  Platform.OS === "ios"
    ? "itms-apps://itunes.apple.com/app/id000000000?action=write-review"
    : "https://play.google.com/store/apps/details?id=com.timemapper.app";

const SUPPORT_MAILTO_URL = "mailto:info@peipe.org?subject=Time%20Mapper%20support";

export function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    isPro,
    restore,
    offerings,
    currentPlan,
    productIdentifier,
    willRenew,
    expirationDate,
  } = usePro();
  const [restoreState, setRestoreState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const placesRepo = usePlacesRepo();
  const entriesRepo = useEntriesRepo();
  const kv = useKvRepo();
  const { reset: resetOnboardingFlag } = useOnboardingGate();
  const themeOverride = useUiStore((s) => s.themeOverride);
  const setThemeOverride = useUiStore((s) => s.setThemeOverride);
  const localeOverride = useUiStore((s) => s.localeOverride);
  const setLocaleOverride = useUiStore((s) => s.setLocaleOverride);

  // Local sheet visibility flags. We do NOT route these through sheetStore —
  // they're Settings-local, never deep-linked, and keeping them here avoids
  // widening the sheetStore payload discriminator.
  const [notificationsSheetVisible, setNotificationsSheetVisible] = useState(false);
  const [buffersSheetVisible, setBuffersSheetVisible] = useState(false);

  const handleOpenPaywall = useCallback((source: PaywallSource) => {
    openPaywall({ source });
  }, []);

  const handleOpenExportPaywall = useCallback(() => {
    handleOpenPaywall("export");
  }, [handleOpenPaywall]);

  const monthlyPriceLabel = offerings?.monthly?.product.priceString ?? null;
  const annualSavingsPercent = useMemo(() => {
    const m = offerings?.monthly?.product.price;
    const a = offerings?.annual?.product.price;
    if (!m || !a || m <= 0) return 0;
    return Math.max(0, Math.round((1 - a / 12 / m) * 100));
  }, [offerings]);

  const handleChangePlan = useCallback(
    (target: "monthly" | "annual") => {
      if (!productIdentifier) return;
      openPlanChange({
        source: target === "annual" ? "settings-upgrade" : "settings-downgrade",
        currentProductId: productIdentifier,
      });
    },
    [productIdentifier],
  );

  const {
    retentionLabel,
    telemetryEnabled,
    handleCycleRetention,
    handleExport,
    handleExportBackup,
    handleToggleTelemetry,
    handleShowOnboarding,
    handleResetAllData,
  } = useSettingsDataHandlers({
    kv,
    placesRepo,
    entriesRepo,
    router,
    resetOnboardingFlag,
    isPro,
    onOpenExportPaywall: handleOpenExportPaywall,
  });

  const handleCycleTheme = useCallback(() => {
    setThemeOverride(nextTheme(themeOverride));
  }, [themeOverride, setThemeOverride]);

  const handleCycleLanguage = useCallback(() => {
    const next = nextLocale(localeOverride);
    setLocaleOverride(next);
    // Apply immediately without waiting for a reload — `setLocale` both
    // updates `i18n.locale` and re-emits any I18n-backed values.
    setLocale(next ?? pickSystemLocale());
  }, [localeOverride, setLocaleOverride]);

  // Legal routes live under `app/legal/*` — the typed-routes generator
  // runs at `expo start` time so the string-literal types aren't visible
  // during `tsc --noEmit`. Route through the `legalRoute` helper which
  // centralizes the cast behind an exhaustive union (typo-safe).
  const handleOpenPrivacy = useCallback(() => {
    router.push(legalRoute("/legal/privacy"));
  }, [router]);

  const handleOpenTerms = useCallback(() => {
    router.push(legalRoute("/legal/terms"));
  }, [router]);

  const handleOpenImpressum = useCallback(() => {
    router.push(legalRoute("/legal/impressum"));
  }, [router]);

  const handleOpenLocationSettings = useCallback(() => {
    void Linking.openSettings().catch((err) => {
      captureException(err, { scope: "openLocationSettings" });
    });
  }, []);

  // Real-time OS notification permission — drives both the Notifications
  // row detail ("On" / "Off") and whether tapping the row opens our
  // quiet-hours / digest sheet vs. iOS's own notification-settings page.
  // iOS hard-locks the permission prompt after a first denial; the only
  // recovery is the user flipping the toggle in Settings themselves.
  const notifPerm = useNotificationPermission();
  const notificationsDenied = notifPerm.status === "denied";
  const locPerm = useLocationPermission();
  const bufferDetail = useMemo(() => {
    const { entryBufferS, exitBufferS } = readGlobalBuffers(kv);
    return i18n.t("settings.tracking.buffers.detailValue", {
      entry: Math.max(1, Math.round(entryBufferS / 60)),
      exit: Math.max(1, Math.round(exitBufferS / 60)),
    });
    // buffersSheetVisible flips when the user closes BuffersSheet after
    // persisting a new value — rebinding here catches that without a
    // larger refactor to put the buffers into a reactive store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kv, buffersSheetVisible]);

  const handleOpenNotifications = useCallback(() => {
    if (notificationsDenied) {
      void Linking.openSettings().catch((err) => {
        captureException(err, { scope: "openNotificationSettings" });
      });
      return;
    }
    setNotificationsSheetVisible(true);
  }, [notificationsDenied]);

  const handleOpenBuffers = useCallback(() => {
    setBuffersSheetVisible(true);
  }, []);

  const handleRateApp = useCallback(() => {
    (async () => {
      try {
        if (await StoreReview.isAvailableAsync()) {
          await StoreReview.requestReview();
          return;
        }
      } catch (err) {
        captureException(err, { scope: "storeReview" });
      }
      await Linking.openURL(STORE_REVIEW_FALLBACK_URL);
    })().catch((err) => captureException(err, { scope: "rateApp" }));
  }, []);

  const handleSupport = useCallback(() => {
    void Linking.openURL(SUPPORT_MAILTO_URL).catch((err) => {
      captureException(err, { scope: "support" });
    });
  }, []);

  const handleManageSubscription = useCallback(() => {
    void presentCustomerCenter().catch((err) => {
      captureException(err, { scope: "customerCenter" });
      void Linking.openURL(SUBSCRIPTION_MANAGEMENT_URL);
    });
  }, []);

  const handleRestore = useCallback(async () => {
    setRestoreState("busy");
    try {
      await restore();
      setRestoreState("done");
    } catch (err) {
      captureException(err, { scope: "restore" });
      setRestoreState("error");
    }
  }, [restore]);

  return (
    <>
      <ScrollView
        testID="settings-screen"
        style={{ flex: 1, backgroundColor: t.color("color.bg") }}
        contentContainerStyle={{
          paddingTop: insets.top + t.space[3],
          paddingBottom: insets.bottom + t.space[8],
        }}
      >
        {/* Heading */}
        <View
          style={{
            paddingHorizontal: t.space[5],
            paddingBottom: t.space[5],
          }}
        >
          <Text
            style={{
              fontSize: t.type.size.xl,
              fontWeight: t.type.weight.bold,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              letterSpacing: -0.5,
            }}
          >
            {i18n.t("settings.title")}
          </Text>
        </View>

        {!isPro ? (
          <ProUpsellCard
            onPress={() => handleOpenPaywall("settings")}
            testID="settings-pro-upsell"
          />
        ) : null}

        <SettingsTrackingSection
          locationStatus={locPerm.status}
          notificationsDenied={notificationsDenied}
          bufferDetail={bufferDetail}
          onOpenLocationSettings={handleOpenLocationSettings}
          onOpenNotificationsSheet={handleOpenNotifications}
          onOpenBuffersSheet={handleOpenBuffers}
        />

        <SettingsAppearanceSection
          themeOverride={themeOverride}
          localeOverride={localeOverride}
          onCycleTheme={handleCycleTheme}
          onCycleLanguage={handleCycleLanguage}
        />

        <SettingsSubscriptionSection
          isPro={isPro}
          currentPlan={currentPlan}
          productIdentifier={productIdentifier}
          willRenew={willRenew}
          expirationDate={expirationDate}
          monthlyPriceLabel={monthlyPriceLabel}
          annualSavingsPercent={annualSavingsPercent}
          restoreState={restoreState}
          onManagePlan={handleManageSubscription}
          onChangePlan={handleChangePlan}
          onRestore={handleRestore}
        />

        <SettingsDataSection
          isPro={isPro}
          ProChip={ProChip}
          placesRepo={placesRepo}
          entriesRepo={entriesRepo}
          retentionLabel={retentionLabel}
          telemetryEnabled={telemetryEnabled}
          onExport={handleExport}
          onExportBackup={handleExportBackup}
          onCycleRetention={handleCycleRetention}
          onToggleTelemetry={handleToggleTelemetry}
          onShowOnboarding={handleShowOnboarding}
          onResetAllData={handleResetAllData}
        />

        <SettingsAboutSection
          onOpenPrivacy={handleOpenPrivacy}
          onOpenTerms={handleOpenTerms}
          onOpenImpressum={handleOpenImpressum}
          onSupport={handleSupport}
          onRate={handleRateApp}
        />
      </ScrollView>

      {/* Settings-local sheets — not routed through sheetStore. */}
      <NotificationsSheet
        visible={notificationsSheetVisible}
        onClose={() => setNotificationsSheetVisible(false)}
      />
      <BuffersSheet visible={buffersSheetVisible} onClose={() => setBuffersSheetVisible(false)} />
    </>
  );
}

/**
 * Default OS locale — only used when clearing an override. Imported lazily
 * because `expo-localization` pulls a native module we don't want to touch
 * in Jest unless we have to.
 */
function pickSystemLocale(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require("expo-localization") as {
      getLocales: () => { languageCode?: string }[];
    };
    return getLocales()[0]?.languageCode === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}
