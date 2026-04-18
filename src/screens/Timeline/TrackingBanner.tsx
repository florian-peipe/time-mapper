import React, { useCallback } from "react";
import { Linking } from "react-native";
import { Banner } from "@/components";
import { i18n } from "@/lib/i18n";
import { useLocationPermission } from "@/features/permissions/hooks";

/**
 * Surfaces the auto-tracking status on Timeline. Three cases:
 *   - "granted" / "undetermined" / loading     → render nothing
 *   - "foreground-only"                        → warning: "Auto-tracking paused"
 *   - "denied"                                 → danger:  "Auto-tracking off"
 *
 * Tapping the action opens the OS app settings page so the user can flip
 * the permission. We don't try to re-prompt inline — iOS won't re-show a
 * dialog once the user has denied, so a deep-link is the only real recovery.
 */
export function TrackingBanner() {
  const { status } = useLocationPermission();

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  if (status === "granted" || status === "undetermined") return null;

  if (status === "foreground-only") {
    return (
      <Banner
        tone="warning"
        title={i18n.t("tracking.banner.foregroundOnly")}
        action={{ label: i18n.t("tracking.banner.cta"), onPress: handleOpenSettings }}
        testID="tracking-banner-fg-only"
      />
    );
  }

  return (
    <Banner
      tone="danger"
      title={i18n.t("tracking.banner.denied")}
      action={{ label: i18n.t("tracking.banner.cta"), onPress: handleOpenSettings }}
      testID="tracking-banner-denied"
    />
  );
}
