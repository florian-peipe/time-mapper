import { useCallback, useEffect, useState } from "react";
import {
  getLocationStatus,
  getNotificationsStatus,
  requestForegroundLocation,
  requestBackgroundLocation,
  requestNotifications,
  type LocationPermissionStatus,
  type NotificationPermissionStatus,
} from "./index";

/**
 * Reactive wrapper around the location permission status. Refreshes on
 * mount and after `request()`. Callers use `status` for conditional UI and
 * `request()` to kick off the two-step prompt (foreground → background).
 */
export function useLocationPermission(): {
  status: LocationPermissionStatus;
  loading: boolean;
  request: () => Promise<LocationPermissionStatus>;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<LocationPermissionStatus>("undetermined");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await getLocationStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getLocationStatus();
      if (active) {
        setStatus(s);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const request = useCallback(async (): Promise<LocationPermissionStatus> => {
    const fg = await requestForegroundLocation();
    if (fg !== "foreground-only") {
      setStatus(fg);
      return fg;
    }
    // Foreground granted — ask for background.
    const bg = await requestBackgroundLocation();
    setStatus(bg);
    return bg;
  }, []);

  return { status, loading, request, refresh };
}

export function useNotificationPermission(): {
  status: NotificationPermissionStatus;
  loading: boolean;
  request: () => Promise<NotificationPermissionStatus>;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<NotificationPermissionStatus>("undetermined");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await getNotificationsStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getNotificationsStatus();
      if (active) {
        setStatus(s);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const request = useCallback(async (): Promise<NotificationPermissionStatus> => {
    const s = await requestNotifications();
    setStatus(s);
    return s;
  }, []);

  return { status, loading, request, refresh };
}
