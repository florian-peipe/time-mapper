import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { useClosestPlace, type ClosestPlace } from "@/features/places/useClosestPlace";

/**
 * Positional awareness indicator on the Timeline. Consumes
 * `useClosestPlace()` (which polls GPS every 60s and picks the saved
 * place whose radius the user is inside, or the closest within 2×).
 *
 *   - "Inside {name}"         when inside any place's radius
 *   - "~{n}m from {name}"     when within 2× the place's radius
 *   - nothing                 when there's no GPS fix, no places, or the
 *                             user is far from every place
 *
 * Separate from the geofence state machine — live readout, not
 * a tracking signal.
 */
export function NearbyPlacesBanner() {
  const closest = useClosestPlace();
  if (!closest) return null;
  return <BannerView closest={closest} />;
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
