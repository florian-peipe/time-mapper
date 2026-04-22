import React from "react";
import { ListRow, Section } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import type { LocationPermissionStatus } from "@/features/permissions";
import { locationDetailKeyFor } from "./SettingsLabels";

type Props = {
  locationStatus: LocationPermissionStatus;
  notificationsDenied: boolean;
  bufferDetail: string;
  onOpenLocationSettings: () => void;
  onOpenNotificationsSheet: () => void;
  onOpenBuffersSheet: () => void;
};

/**
 * Tracking section — location permission row, notifications row (opens
 * quiet-hours / digest sheet or OS Settings when denied), and default
 * buffers row (opens BuffersSheet). Extracted from `SettingsScreen.tsx`
 * to keep the orchestrator file under 350 lines.
 */
export function SettingsTrackingSection({
  locationStatus,
  notificationsDenied,
  bufferDetail,
  onOpenLocationSettings,
  onOpenNotificationsSheet,
  onOpenBuffersSheet,
}: Props) {
  const t = useTheme();
  const locationDetailKey = locationDetailKeyFor(locationStatus);

  return (
    <Section title={i18n.t("settings.section.tracking")} testID="settings-section-tracking">
      <ListRow
        icon="map-pin"
        iconBg={
          locationStatus === "granted"
            ? t.color("color.success.soft")
            : t.color("color.warning.soft")
        }
        iconColor={
          locationStatus === "granted" ? t.color("color.success") : t.color("color.warning")
        }
        title={i18n.t("settings.tracking.location")}
        detail={i18n.t(locationDetailKey)}
        onPress={onOpenLocationSettings}
        testID="settings-row-location"
      />
      <ListRow
        icon="bell"
        iconBg={notificationsDenied ? t.color("color.warning.soft") : t.color("color.accent.soft")}
        iconColor={notificationsDenied ? t.color("color.warning") : t.color("color.accent")}
        title={i18n.t("settings.tracking.notifications")}
        detail={
          notificationsDenied
            ? i18n.t("settings.tracking.notifications.detailDenied")
            : i18n.t("settings.tracking.notifications.detail")
        }
        onPress={onOpenNotificationsSheet}
        testID="settings-row-notifications"
      />
      <ListRow
        icon="clock"
        title={i18n.t("settings.tracking.buffers")}
        detail={bufferDetail}
        onPress={onOpenBuffersSheet}
        last
        testID="settings-row-buffers"
      />
    </Section>
  );
}
