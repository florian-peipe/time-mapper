import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
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
    // AppState subscription: re-read the permission status each time the
    // app returns to the foreground, so a user who toggled the OS setting
    // while backgrounded sees the updated state on return.
    const onChange = (next: AppStateStatus) => {
      if (next === "active") {
        void (async () => {
          const s = await getLocationStatus();
          if (active) setStatus(s);
        })();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      active = false;
      sub.remove();
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
    const onChange = (next: AppStateStatus) => {
      if (next === "active") {
        void (async () => {
          const s = await getNotificationsStatus();
          if (active) setStatus(s);
        })();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const request = useCallback(async (): Promise<NotificationPermissionStatus> => {
    const s = await requestNotifications();
    setStatus(s);
    return s;
  }, []);

  return { status, loading, request, refresh };
}
