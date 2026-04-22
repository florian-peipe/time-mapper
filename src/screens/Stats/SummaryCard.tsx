import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Card } from "@/components";
import { i18n } from "@/lib/i18n";
import type { Place } from "@/db/schema";
import type { RangeMode } from "@/lib/range";
import { PlaceBar } from "./PlaceBar";

type Props = {
  totalMin: number;
  perPlace: { place: Place; minutes: number }[];
  mode: RangeMode;
  /**
   * Start of the current window as a Date — used by PlaceBar to decide
   * whether a daily goal is active for that weekday.
   */
  viewedDate: Date;
};

/**
 * Per-place totals card at the top of the Stats screen. Renders the
 * overall hours/minutes headline plus a PlaceBar per place with data.
 */
export function SummaryCard({ totalMin, perPlace, mode, viewedDate }: Props) {
  const t = useTheme();
  const max = Math.max(1, ...perPlace.map((p) => p.minutes));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  return (
    <View style={{ paddingHorizontal: t.space[5], paddingTop: t.space[2] }}>
      <Card padding={4}>
        <Text
          style={{
            fontSize: t.type.size.xs,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: t.space[1],
          }}
        >
          {i18n.t("stats.summary.label")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.display,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            letterSpacing: -0.6,
            fontVariant: ["tabular-nums"],
          }}
          testID="stats-summary-total"
        >
          {i18n.t("stats.summary.total", { hours, minutes })}
        </Text>

        {perPlace.length > 0 ? (
          <View style={{ marginTop: t.space[3], gap: t.space[2] }}>
            {perPlace.map(({ place, minutes: m }) => (
              <PlaceBar
                key={place.id}
                place={place}
                minutes={m}
                max={max}
                mode={mode}
                viewedDate={viewedDate}
              />
            ))}
          </View>
        ) : (
          <Text
            style={{
              marginTop: t.space[2],
              fontSize: t.type.size.s,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("stats.summary.empty")}
          </Text>
        )}
      </Card>
    </View>
  );
}
