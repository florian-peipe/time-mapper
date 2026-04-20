import React, { useCallback, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as StoreReview from "expo-store-review";
import { useTheme } from "@/theme/useTheme";
import { ListRow, Section } from "@/components";
import { usePlacesRepo } from "@/features/places/usePlaces";
import { useEntriesRepo } from "@/features/entries/useEntries";
import { useLocationPermission, useNotificationPermission } from "@/features/permissions/hooks";
import { readGlobalBuffers, BuffersSheet } from "./BuffersSheet";
import { usePro } from "@/features/billing/usePro";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore, type ThemeOverride } from "@/state/uiStore";
import { useSnackbarStore } from "@/state/snackbarStore";
import { i18n, setLocale } from "@/lib/i18n";
import { legalRoute } from "@/lib/routes";
import { ProUpsellCard } from "./ProUpsellCard";
import { exportDiagnosticLog } from "@/features/diagnostics/exportLog";
import { exportEntriesCsv } from "@/features/diagnostics/exportEntries";
import { useKvRepo, useOnboardingGate } from "@/features/onboarding/useOnboardingGate";
import { getTelemetryEnabled, setTelemetryEnabled } from "@/features/diagnostics/telemetryConsent";
import { resetAllData } from "@/features/diagnostics/resetAllData";
import { buildBackupPayload, exportBackupJson } from "@/features/diagnostics/backup";
import { PendingTransitionsRepo } from "@/db/repository/pending";
import { NotificationsSheet } from "./NotificationsSheet";

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

// Placeholder — developer replaces before ship (tracked in README).
const SUPPORT_MAILTO_URL = "mailto:support@timemapper.app?subject=Time%20Mapper%20support";

export function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { isPro, restore } = usePro();
  const [restoreState, setRestoreState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const placesRepo = usePlacesRepo();
  const entriesRepo = useEntriesRepo();
  const kv = useKvRepo();
  const [telemetryEnabled, setTelemetryEnabledLocal] = useState(() => getTelemetryEnabled(kv));
  const { reset: resetOnboardingFlag } = useOnboardingGate();
  const openSheet = useSheetStore((s) => s.openSheet);
  const themeOverride = useUiStore((s) => s.themeOverride);
  const setThemeOverride = useUiStore((s) => s.setThemeOverride);
  const localeOverride = useUiStore((s) => s.localeOverride);
  const setLocaleOverride = useUiStore((s) => s.setLocaleOverride);

  // Local sheet visibility flags. We do NOT route these through sheetStore —
  // they're Settings-local, never deep-linked, and keeping them here avoids
  // widening the sheetStore payload discriminator.
  const [notificationsSheetVisible, setNotificationsSheetVisible] = useState(false);
  const [buffersSheetVisible, setBuffersSheetVisible] = useState(false);

  const handleOpenPaywall = useCallback(
    (source: "settings" | "export" | "history") => {
      openSheet("paywall", { source });
    },
    [openSheet],
  );

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

  const handleExportDiagnostics = useCallback(() => {
    void exportDiagnosticLog().catch((err) => {
      console.warn("Failed to export diagnostic log", err);
    });
  }, []);

  const handleExportBackup = useCallback(() => {
    (async () => {
      try {
        // Lazy require — keep the raw `db` off the test import graph.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { db } = require("@/db/client");
        const pending = new PendingTransitionsRepo(db);
        const payload = buildBackupPayload(
          placesRepo.list(),
          entriesRepo.listAll(),
          pending.listAll(),
        );
        const shared = await exportBackupJson(payload);
        if (!shared) {
          useSnackbarStore
            .getState()
            .show({ message: i18n.t("settings.data.export.unavailable"), ttlMs: 4000 });
        }
      } catch (err) {
        console.warn("backup export failed", err);
        useSnackbarStore
          .getState()
          .show({ message: i18n.t("settings.data.export.failed"), ttlMs: 4000 });
      }
    })();
  }, [placesRepo, entriesRepo]);

  const handleExport = useCallback(() => {
    if (!isPro) {
      handleOpenPaywall("export");
      return;
    }
    (async () => {
      try {
        const entries = entriesRepo.listAll();
        const placesById = new Map(placesRepo.list().map((p) => [p.id, p]));
        const shared = await exportEntriesCsv(entries, placesById);
        if (!shared) {
          useSnackbarStore
            .getState()
            .show({ message: i18n.t("settings.data.export.unavailable"), ttlMs: 4000 });
        }
      } catch (err) {
        console.warn("CSV export failed", err);
        useSnackbarStore
          .getState()
          .show({ message: i18n.t("settings.data.export.failed"), ttlMs: 4000 });
      }
    })();
  }, [isPro, handleOpenPaywall, entriesRepo, placesRepo]);

  const handleShowOnboarding = useCallback(() => {
    router.push("/(onboarding)/welcome");
  }, [router]);

  const handleResetAllData = useCallback(() => {
    Alert.alert(
      i18n.t("settings.data.reset.confirmTitle"),
      i18n.t("settings.data.reset.confirmBody"),
      [
        { text: i18n.t("common.cancel"), style: "cancel" },
        {
          text: i18n.t("settings.data.reset.confirmCta"),
          style: "destructive",
          onPress: () => {
            // Second-level confirmation — destructive + irreversible.
            Alert.alert(
              i18n.t("settings.data.reset.doubleTitle"),
              i18n.t("settings.data.reset.doubleBody"),
              [
                { text: i18n.t("common.cancel"), style: "cancel" },
                {
                  text: i18n.t("settings.data.reset.doubleCta"),
                  style: "destructive",
                  onPress: () => {
                    void (async () => {
                      try {
                        // Lazy require — keeps expo-sqlite off the test import
                        // graph; SettingsScreen renders in jest-expo with no
                        // native binding available.
                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                        const { db } = require("@/db/client");
                        await resetAllData(db);
                        resetOnboardingFlag();
                        // Route back to onboarding so the UX exits from the
                        // same place the user first entered.
                        router.replace("/(onboarding)/welcome");
                      } catch (err) {
                        console.warn("resetAllData failed", err);
                      }
                    })();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [resetOnboardingFlag, router]);

  const handleToggleTelemetry = useCallback(() => {
    const next = !telemetryEnabled;
    setTelemetryEnabled(kv, next);
    setTelemetryEnabledLocal(next);
    // The live Sentry instance keeps running for this session if we just
    // flipped off (Sentry has no public teardown). Explain that to the
    // user via a short snackbar so they aren't confused by the delay.
    useSnackbarStore.getState().show({
      message: i18n.t(
        next ? "settings.data.telemetry.enabledNote" : "settings.data.telemetry.disabledNote",
      ),
      ttlMs: 4000,
    });
  }, [telemetryEnabled, kv]);

  const handleOpenLocationSettings = useCallback(() => {
    void Linking.openSettings().catch((err) => {
      console.warn("Failed to open OS settings", err);
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
  const locationDetailKey = locationDetailKeyFor(locPerm.status);
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
        console.warn("Failed to open OS settings", err);
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
        console.warn("StoreReview failed, falling back to store URL", err);
      }
      await Linking.openURL(STORE_REVIEW_FALLBACK_URL);
    })().catch((err) => console.warn("Rate app flow failed", err));
  }, []);

  const handleSupport = useCallback(() => {
    void Linking.openURL(SUPPORT_MAILTO_URL).catch((err) => {
      console.warn("Failed to open mailto:", err);
    });
  }, []);

  const handleManageSubscription = useCallback(() => {
    void Linking.openURL(SUBSCRIPTION_MANAGEMENT_URL);
  }, []);

  const handleRestore = useCallback(async () => {
    setRestoreState("busy");
    try {
      await restore();
      setRestoreState("done");
    } catch (err) {
      console.warn("settings: restore failed", err);
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

        <Section title={i18n.t("settings.section.tracking")} testID="settings-section-tracking">
          <ListRow
            icon="map-pin"
            iconBg={
              locPerm.status === "granted"
                ? t.color("color.success.soft")
                : t.color("color.warning.soft")
            }
            iconColor={
              locPerm.status === "granted" ? t.color("color.success") : t.color("color.warning")
            }
            title={i18n.t("settings.tracking.location")}
            detail={i18n.t(locationDetailKey)}
            onPress={handleOpenLocationSettings}
            testID="settings-row-location"
          />
          <ListRow
            icon="bell"
            iconBg={
              notificationsDenied ? t.color("color.warning.soft") : t.color("color.accent.soft")
            }
            iconColor={notificationsDenied ? t.color("color.warning") : t.color("color.accent")}
            title={i18n.t("settings.tracking.notifications")}
            detail={
              notificationsDenied
                ? i18n.t("settings.tracking.notifications.detailDenied")
                : i18n.t("settings.tracking.notifications.detail")
            }
            onPress={handleOpenNotifications}
            testID="settings-row-notifications"
          />
          <ListRow
            icon="clock"
            title={i18n.t("settings.tracking.buffers")}
            detail={bufferDetail}
            onPress={handleOpenBuffers}
            last
            testID="settings-row-buffers"
          />
        </Section>

        <Section title={i18n.t("settings.section.appearance")} testID="settings-section-appearance">
          <ListRow
            icon="moon"
            title={i18n.t("settings.appearance.theme")}
            detail={themeLabel(themeOverride)}
            onPress={handleCycleTheme}
            testID="settings-row-theme"
          />
          <ListRow
            icon="globe"
            title={i18n.t("settings.appearance.language")}
            detail={languageLabel(localeOverride)}
            onPress={handleCycleLanguage}
            last
            testID="settings-row-language"
          />
        </Section>

        <Section
          title={i18n.t("settings.section.subscription")}
          testID="settings-section-subscription"
        >
          {isPro ? (
            <ListRow
              icon="star"
              iconBg={t.color("color.accent.soft")}
              iconColor={t.color("color.accent")}
              title={i18n.t("settings.subscription.active")}
              detail={i18n.t("settings.subscription.active.detail")}
              onPress={handleManageSubscription}
              testID="settings-row-pro-active"
            />
          ) : null}
          <ListRow
            icon="repeat"
            title={i18n.t("settings.subscription.restore")}
            detail={restoreLabel(restoreState)}
            onPress={handleRestore}
            last
            testID="settings-row-restore"
            accessibilityState={{ busy: restoreState === "busy" }}
          />
        </Section>

        <Section title={i18n.t("settings.section.data")} testID="settings-section-data">
          <ListRow
            icon="download"
            iconBg={isPro ? t.color("color.accent.soft") : t.color("color.surface2")}
            iconColor={isPro ? t.color("color.accent") : t.color("color.fg3")}
            title={i18n.t("settings.data.export")}
            detail={!isPro ? <ProChip /> : undefined}
            onPress={handleExport}
            testID="settings-row-export"
          />
          <ListRow
            icon="download"
            title={i18n.t("settings.data.backup")}
            detail={i18n.t("settings.data.backup.detail")}
            onPress={handleExportBackup}
            testID="settings-row-backup"
          />
          <ListRow
            icon="download"
            title={i18n.t("settings.data.diagnostics")}
            detail={i18n.t("settings.data.diagnostics.detail")}
            onPress={handleExportDiagnostics}
            testID="settings-row-diagnostics"
          />
          <ListRow
            icon="lock"
            title={i18n.t("settings.data.telemetry")}
            detail={i18n.t(
              telemetryEnabled ? "settings.data.telemetry.on" : "settings.data.telemetry.off",
            )}
            onPress={handleToggleTelemetry}
            testID="settings-row-telemetry"
            accessibilityState={{ checked: telemetryEnabled }}
          />
          <ListRow
            icon="repeat"
            title={i18n.t("settings.data.showOnboarding")}
            detail={i18n.t("settings.data.showOnboarding.detail")}
            onPress={handleShowOnboarding}
            testID="settings-row-show-onboarding"
          />
          <ListRow
            icon="x"
            iconBg={t.color("color.danger.soft")}
            iconColor={t.color("color.danger")}
            title={i18n.t("settings.data.reset")}
            detail={i18n.t("settings.data.reset.detail")}
            onPress={handleResetAllData}
            last
            testID="settings-row-reset"
          />
        </Section>

        <Section title={i18n.t("settings.section.about")} testID="settings-section-about">
          <ListRow
            icon="heart"
            title={i18n.t("settings.about.privacy")}
            onPress={handleOpenPrivacy}
            testID="settings-row-privacy"
          />
          <ListRow
            icon="book-open"
            title={i18n.t("settings.about.terms")}
            onPress={handleOpenTerms}
            testID="settings-row-terms"
          />
          <ListRow
            icon="info"
            title={i18n.t("settings.about.impressum")}
            onPress={handleOpenImpressum}
            testID="settings-row-impressum"
          />
          <ListRow
            icon="bell"
            title={i18n.t("settings.about.support")}
            detail={i18n.t("settings.about.support.detail")}
            onPress={handleSupport}
            testID="settings-row-support"
          />
          <ListRow
            icon="star"
            title={i18n.t("settings.about.rate")}
            onPress={handleRateApp}
            last
            testID="settings-row-rate"
          />
        </Section>
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
 * Right-side label for the Restore purchases row. Reflects the in-flight
 * + post-completion state so the user knows their tap was acknowledged.
 */
function restoreLabel(state: "idle" | "busy" | "done" | "error"): string | undefined {
  if (state === "busy") return i18n.t("settings.subscription.restore.busy");
  if (state === "done") return i18n.t("settings.subscription.restore.done");
  if (state === "error") return i18n.t("settings.subscription.restore.error");
  return undefined;
}

/** Cycle order: System (null) → Light → Dark → System. */
function nextTheme(current: ThemeOverride): ThemeOverride {
  if (current === null) return "light";
  if (current === "light") return "dark";
  return null;
}

/** Human label for the Theme row's right-side detail string. */
function themeLabel(current: ThemeOverride): string {
  if (current === null) return i18n.t("settings.appearance.theme.system");
  if (current === "light") return i18n.t("settings.appearance.theme.light");
  return i18n.t("settings.appearance.theme.dark");
}

/**
 * Locale-cycle order: system (null) → English → German → system.
 */
function nextLocale(current: string | null): string | null {
  if (current === null) return "en";
  if (current === "en") return "de";
  return null;
}

/**
 * Human label for the current language selection. `null` means "follow
 * system locale"; we still surface the active language so the user sees
 * what the app will actually render.
 */
function languageLabel(override: string | null): string {
  if (override === null) return i18n.t("settings.appearance.language.system");
  if (override.startsWith("de")) return i18n.t("settings.appearance.language.de");
  return i18n.t("settings.appearance.language.en");
}

/**
 * Default OS locale — only used when clearing an override. Imported lazily
 * because `expo-localization` pulls a native module we don't want to touch
 * in Jest unless we have to.
 */
/**
 * Pick the right i18n key for the Location row detail based on live OS
 * permission state. Keeps the row honest — if the user flipped Always
 * → When in use in iOS Settings, the row immediately reflects that.
 */
function locationDetailKeyFor(
  status: "granted" | "foreground-only" | "denied" | "undetermined",
): string {
  if (status === "granted") return "settings.tracking.location.detail";
  if (status === "foreground-only") return "settings.tracking.location.detailForeground";
  if (status === "denied") return "settings.tracking.location.detailDenied";
  return "settings.tracking.location.detailUndetermined";
}

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

/**
 * Small "Pro" badge rendered in the Export CSV row's detail slot when the
 * user is on the free plan. Looks like a `Chip` (accent palette) but stays
 * inline-typed inside `ListRow.detail`, so we render it as a flat View+Text
 * rather than reaching for the heavier `Chip` primitive (which has its own
 * Pressable + accessibility role and would be incorrect inside a row's
 * trailing accessory area).
 */
function ProChip() {
  const t = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={i18n.t("settings.proChip")}
      style={{
        // design-source: padding '2px 7px', radius 9999, accent bg
        paddingVertical: 2,
        paddingHorizontal: t.space[2] - 1,
        backgroundColor: t.color("color.accent.soft"),
        borderRadius: t.radius.pill,
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.xs,
          fontWeight: t.type.weight.bold,
          color: t.color("color.accent"),
          fontFamily: t.type.family.sans,
        }}
      >
        {i18n.t("settings.proChip")}
      </Text>
    </View>
  );
}
