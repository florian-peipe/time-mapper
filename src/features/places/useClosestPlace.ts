import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { usePlaces } from "./usePlaces";
import { __internals } from "@/features/tracking/geofenceService";
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
 * Shared by the Timeline's positional banner and quick-add FAB so both
 * always reflect the same "am I near something tracked?" judgment.
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

    void poll();
    const handle = setInterval(() => void poll(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
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
    const d = __internals.haversineMeters(
      fix.coords.latitude,
      fix.coords.longitude,
      p.latitude,
      p.longitude,
    );
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
