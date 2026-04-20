import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as Location from "expo-location";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { usePlaces } from "@/features/places/usePlaces";
import { __internals } from "@/features/tracking/geofenceService";
import type { Place } from "@/db/schema";

/**
 * Positional awareness indicator on the Timeline. Polls the current location
 * every 60s while the screen is mounted and compares against every saved
 * place. Surfaces:
 *
 *   - "Inside {name}"         when the user is inside any place's radius
 *   - "~{n}m from {name}"     when within 2× the place's radius
 *   - nothing                 when there's no GPS fix, no places, or the
 *                             user is far from every place
 *
 * If multiple places match, the closest one wins. This is separate from
 * the geofence state machine — it's a live "am I near something tracked?"
 * readout, not a tracking-state signal.
 */
export function NearbyPlacesBanner() {
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
        setClosest(findClosest(fix, places));
      } catch {
        // Swallow — not worth surfacing; geofence permission banner
        // already handles the denied / undetermined cases.
      }
    }

    void poll();
    const handle = setInterval(() => void poll(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [places]);

  if (!closest) return null;

  return <BannerView closest={closest} />;
}

type ClosestPlace = {
  place: Place;
  distanceM: number;
  inside: boolean;
};

function findClosest(
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
    // Only surface places within 2× their radius — beyond that, "near" stops
    // being useful information.
    if (d > p.radiusM * 2) continue;
    if (!best || d < best.distanceM) {
      best = { place: p, distanceM: d, inside: d <= p.radiusM };
    }
  }
  return best;
}

function BannerView({ closest }: { closest: ClosestPlace }) {
  const t = useTheme();
  const { place, distanceM, inside } = closest;
  const title = inside
    ? i18n.t("timeline.nearby.inside", { name: place.name })
    : i18n.t("timeline.nearby.near", { meters: Math.round(distanceM), name: place.name });
  return (
    <View
      accessibilityLiveRegion="polite"
      testID="timeline-nearby-banner"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.space[2],
        paddingVertical: t.space[2] - 2,
        paddingHorizontal: t.space[3],
        backgroundColor: inside ? `${place.color}22` : t.color("color.surface2"),
        borderRadius: t.radius.pill,
        alignSelf: "flex-start",
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: inside ? place.color : t.color("color.fg3"),
        }}
      />
      <Icon name="map-pin" size={14} color={inside ? place.color : t.color("color.fg3")} />
      <Text
        style={{
          fontSize: t.type.size.s,
          color: inside ? t.color("color.fg") : t.color("color.fg2"),
          fontFamily: t.type.family.sans,
          fontWeight: inside ? t.type.weight.semibold : t.type.weight.regular,
        }}
      >
        {title}
      </Text>
    </View>
  );
}
