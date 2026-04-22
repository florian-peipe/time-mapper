import React, { useCallback, useMemo } from "react";
import { Linking } from "react-native";
import { Banner } from "@/components";
import { i18n } from "@/lib/i18n";
import { useLocationPermission } from "@/features/permissions/hooks";
import { useKvRepo } from "@/features/onboarding/useOnboardingGate";
import { usePlaces } from "@/features/places/usePlaces";
import { classifyTrackingHealth, readLastBgFire } from "@/features/tracking/trackingHealth";
import { nowS } from "@/lib/time";

/**
 * Surfaces the auto-tracking status on Timeline. Cases:
 *   - granted + fresh bg fire          → render nothing (the healthy path)
 *   - granted + stale bg fire (>48h)   → warning: battery optimizer may have killed us
 *   - "foreground-only"                → warning: "Auto-tracking paused"
 *   - "denied"                         → danger:  "Auto-tracking off"
 *   - "undetermined" / loading / no places → render nothing
 *
 * Tapping the action opens the OS app settings page so the user can flip
 * the permission or exempt us from battery optimisation.
 */
export function TrackingBanner() {
  const { status } = useLocationPermission();
  const kv = useKvRepo();
  const { places } = usePlaces();

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  // Derive health from perm + last task fire. Re-evaluates on render, so
  // any KV write or permission change is reflected without manual refresh.
  const health = useMemo(
    () =>
      classifyTrackingHealth({
        locationStatus: status === "undetermined" ? "unknown" : status,
        lastBgFireAtS: readLastBgFire(kv),
        nowS: nowS(),
        placesCount: places.length,
      }),
    [status, kv, places.length],
  );

  if (status === "granted" && health === "healthy") return null;
  if (status === "undetermined") return null;

  if (status === "granted" && (health === "degraded" || health === "stopped")) {
    return (
      <Banner
        tone="warning"
        title={i18n.t("tracking.banner.stale")}
        body={i18n.t("tracking.banner.stale.body")}
        action={{ label: i18n.t("tracking.banner.cta"), onPress: handleOpenSettings }}
        testID="tracking-banner-stale"
      />
    );
  }

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

  if (status === "denied") {
    return (
      <Banner
        tone="danger"
        title={i18n.t("tracking.banner.denied")}
        action={{ label: i18n.t("tracking.banner.cta"), onPress: handleOpenSettings }}
        testID="tracking-banner-denied"
      />
    );
  }

  return null;
}
