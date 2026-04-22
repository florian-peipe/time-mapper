import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import type { Router } from "expo-router";
import { useSnackbarStore } from "@/state/snackbarStore";
import { i18n } from "@/lib/i18n";
import { exportEntriesCsv } from "@/features/diagnostics/exportEntries";
import { getTelemetryEnabled, setTelemetryEnabled } from "@/features/diagnostics/telemetryConsent";
import { resetAllData } from "@/features/diagnostics/resetAllData";
import { buildBackupPayload, exportBackupJson } from "@/features/diagnostics/backup";
import { PendingTransitionsRepo } from "@/db/repository/pending";
import { getDeviceDb } from "@/db/deviceDb";
import { RETENTION_KV_HARD_CAP_DAYS } from "@/features/diagnostics/retention";
import type { PlacesRepo } from "@/db/repository/places";
import type { EntriesRepo } from "@/db/repository/entries";
import type { KvRepo } from "@/db/repository/kv";

/**
 * Retention cap cycle — tapping the row advances through these values.
 * `null` = no cap (keep forever). Stored in KV as integer days.
 */
const RETENTION_CYCLE: readonly (number | null)[] = [null, 180, 365, 730];

type Params = {
  kv: KvRepo;
  placesRepo: PlacesRepo;
  entriesRepo: EntriesRepo;
  router: Router;
  resetOnboardingFlag: () => void;
  isPro: boolean;
  onOpenExportPaywall: () => void;
};

type Result = {
  retentionLabel: string;
  telemetryEnabled: boolean;
  handleCycleRetention: () => void;
  handleExport: () => void;
  handleExportBackup: () => void;
  handleToggleTelemetry: () => void;
  handleShowOnboarding: () => void;
  handleResetAllData: () => void;
};

/**
 * Collects the Data-section handlers + the retention/telemetry local state
 * into a single hook so `SettingsScreen.tsx` stays under the 350-line
 * budget. Pure extraction — no behavior change; the hook owns the same
 * state and fires the same side-effects as the inline versions did.
 */
export function useSettingsDataHandlers({
  kv,
  placesRepo,
  entriesRepo,
  router,
  resetOnboardingFlag,
  isPro,
  onOpenExportPaywall,
}: Params): Result {
  const [telemetryEnabled, setTelemetryEnabledLocal] = useState(() => getTelemetryEnabled(kv));

  // Retention cap (days). null = forever. Initial read from KV.
  const [retentionDays, setRetentionDays] = useState<number | null>(() => {
    const raw = kv.get(RETENTION_KV_HARD_CAP_DAYS);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  const handleCycleRetention = useCallback(() => {
    const idx = RETENTION_CYCLE.findIndex((v) => v === retentionDays);
    const next = RETENTION_CYCLE[(idx + 1) % RETENTION_CYCLE.length] ?? null;
    setRetentionDays(next);
    if (next == null) kv.delete(RETENTION_KV_HARD_CAP_DAYS);
    else kv.set(RETENTION_KV_HARD_CAP_DAYS, String(next));
  }, [retentionDays, kv]);

  const retentionLabel = useMemo(() => {
    if (retentionDays == null) return i18n.t("settings.data.history.forever");
    if (retentionDays >= 365) {
      return i18n.t("settings.data.history.years", { n: Math.round(retentionDays / 365) });
    }
    return i18n.t("settings.data.history.months", { n: Math.round(retentionDays / 30) });
  }, [retentionDays]);

  const handleExportBackup = useCallback(() => {
    (async () => {
      try {
        const pending = new PendingTransitionsRepo(getDeviceDb());
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
      onOpenExportPaywall();
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
  }, [isPro, onOpenExportPaywall, entriesRepo, placesRepo]);

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
                        await resetAllData(getDeviceDb());
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

  return {
    retentionLabel,
    telemetryEnabled,
    handleCycleRetention,
    handleExport,
    handleExportBackup,
    handleToggleTelemetry,
    handleShowOnboarding,
    handleResetAllData,
  };
}
