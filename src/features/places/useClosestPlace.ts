import { useEffect, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { usePlaces } from "./usePlaces";
import { haversineMeters } from "@/lib/geo";
import type { Place } from "@/db/schema";

export type ClosestPlace = {
  place: Place;
  distanceM: number;
  inside: boolean;
  /** within 2× the place's radius but not yet inside */
  near: boolean;
};

/**
 * Polls the device's last-known position every 60s and returns the saved
 * place whose radius the user is inside, or — failing that — the closest
 * one within 2× its radius. `null` means "no fix yet" or "far from every
 * place".
 *
 * Polling pauses while the app is backgrounded — `AppState` listener tears
 * down the interval on `background` and re-establishes it on `active`. Tab
 * focus isn't enough on its own (the tab view keeps mounted tabs in memory),
 * so AppState is the right gate for a battery-sensitive poll.
 */
export function useClosestPlace(): ClosestPlace | null {
  const { places } = usePlaces();
  const [closest, setClosest] = useState<ClosestPlace | null>(null);

  useEffect(() => {
    if (places.length === 0) {
      setClosest(null);
      return;
    }

    let cancelled = false;
    let handle: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const fix = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000 });
        if (cancelled || !fix) return;
        setClosest(pickClosest(fix, places));
      } catch {
        // Permission / GPS errors are surfaced by the TrackingBanner,
        // not here — swallow so the FAB/banner just stay quiet.
      }
    }

    function start() {
      if (handle) return;
      void poll();
      handle = setInterval(() => void poll(), 60_000);
    }
    function stop() {
      if (handle) {
        clearInterval(handle);
        handle = null;
      }
    }

    // Start immediately — jest/Expo Go both report `AppState.currentState`
    // as something other than "active" on first eval; gating here would
    // defer the first poll until the user tapped the screen. Backgrounding
    // still stops it below.
    start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });

    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [places]);

  return closest;
}

function pickClosest(
  fix: Pick<Location.LocationObject, "coords">,
  places: Place[],
): ClosestPlace | null {
  let best: ClosestPlace | null = null;
  for (const p of places) {
    const d = haversineMeters(fix.coords.latitude, fix.coords.longitude, p.latitude, p.longitude);
    if (d > p.radiusM * 2) continue;
    const candidate: ClosestPlace = {
      place: p,
      distanceM: d,
      inside: d <= p.radiusM,
      near: d > p.radiusM && d <= p.radiusM * 2,
    };
    if (!best || candidate.distanceM < best.distanceM) best = candidate;
  }
  return best;
}
