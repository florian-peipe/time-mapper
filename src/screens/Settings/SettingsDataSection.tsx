import React from "react";
import { ListRow, Section } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { captureException } from "@/lib/crash";
import type { PlacesRepo } from "@/db/repository/places";
import type { EntriesRepo } from "@/db/repository/entries";

type Props = {
  isPro: boolean;
  ProChip: React.ComponentType;
  placesRepo: PlacesRepo;
  entriesRepo: EntriesRepo;
  retentionLabel: string;
  telemetryEnabled: boolean;
  onExport: () => void;
  onExportBackup: () => void;
  onCycleRetention: () => void;
  onToggleTelemetry: () => void;
  onShowOnboarding: () => void;
  onResetAllData: () => void;
};

/**
 * Data section of the Settings screen — export + backup + retention +
 * telemetry + onboarding + reset. Kept out of `SettingsScreen.tsx` to
 * keep that file under 500 lines and to group all data-related rows in
 * one place.
 *
 * Dev-only test-crash row is included here (guarded by `__DEV__`) since
 * Sentry verification is a data-pipeline concern.
 */
export function SettingsDataSection({
  isPro,
  ProChip,
  placesRepo,
  entriesRepo,
  retentionLabel,
  telemetryEnabled,
  onExport,
  onExportBackup,
  onCycleRetention,
  onToggleTelemetry,
  onShowOnboarding,
  onResetAllData,
}: Props) {
  const t = useTheme();

  return (
    <Section title={i18n.t("settings.section.data")} testID="settings-section-data">
      <ListRow
        icon="download"
        iconBg={isPro ? t.color("color.accent.soft") : t.color("color.surface2")}
        iconColor={isPro ? t.color("color.accent") : t.color("color.fg3")}
        title={i18n.t("settings.data.export")}
        detail={!isPro ? <ProChip /> : undefined}
        onPress={onExport}
        testID="settings-row-export"
      />
      <ListRow
        icon="download"
        title={i18n.t("settings.data.backup")}
        detail={i18n.t("settings.data.backup.detail")}
        onPress={onExportBackup}
        testID="settings-row-backup"
      />
      <ListRow
        icon="clock"
        title={i18n.t("settings.data.history")}
        detail={retentionLabel}
        onPress={onCycleRetention}
        accessibilityHint={i18n.t("settings.data.history.hint")}
        testID="settings-row-history"
      />
      <ListRow
        icon="bar-chart"
        title={i18n.t("settings.data.size")}
        detail={i18n.t("settings.data.size.detail", {
          places: placesRepo.list().length,
          entries: entriesRepo.listAll().length,
        })}
        testID="settings-row-size"
      />
      <ListRow
        icon="lock"
        title={i18n.t("settings.data.telemetry")}
        detail={i18n.t(
          telemetryEnabled ? "settings.data.telemetry.on" : "settings.data.telemetry.off",
        )}
        onPress={onToggleTelemetry}
        testID="settings-row-telemetry"
        accessibilityState={{ checked: telemetryEnabled }}
      />
      <ListRow
        icon="repeat"
        title={i18n.t("settings.data.showOnboarding")}
        detail={i18n.t("settings.data.showOnboarding.detail")}
        onPress={onShowOnboarding}
        testID="settings-row-show-onboarding"
      />
      {__DEV__ ? (
        <ListRow
          icon="alert-triangle"
          iconBg={t.color("color.danger.soft")}
          iconColor={t.color("color.danger")}
          title={i18n.t("settings.dev.testCrash")}
          detail={i18n.t("settings.dev.testCrash.detail")}
          onPress={() => {
            // Fire an explicit Sentry event with a full breadcrumb chain
            // so we can verify the crash-reporting pipeline in a dev build.
            // This row is __DEV__-gated and does not ship in production.
            captureException(new Error("[dev] test crash — verifying Sentry wiring"), {
              scope: "settings.dev.testCrash",
            });
          }}
          testID="settings-row-test-crash"
        />
      ) : null}
      <ListRow
        icon="x"
        iconBg={t.color("color.danger.soft")}
        iconColor={t.color("color.danger")}
        title={i18n.t("settings.data.reset")}
        detail={i18n.t("settings.data.reset.detail")}
        onPress={onResetAllData}
        last
        testID="settings-row-reset"
      />
    </Section>
  );
}
