import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Card, TrackingDot } from "@/components";
import { i18n } from "@/lib/i18n";
import { formatElapsed } from "@/lib/time";

type Props = {
  /** Place display name, shown inline after "Tracking". */
  placeName: string;
  /** Unix seconds when the running entry started. */
  startedAt: number;
  onStop: () => void;
  testID?: string;
};

/**
 * Tile-card showing the currently running entry with a live, tick-per-second
 * elapsed clock. Uses a local `setInterval` rather than a shared clock hook
 * — only this card needs to tick, and `useEffect` cleanup handles unmount.
 */
export function RunningTimerCard({ placeName, startedAt, onStop, testID }: Props) {
  const t = useTheme();
  const elapsed = useElapsed(startedAt);

  return (
    // Accent.soft tint so the running card stands out from the neutral
    // list rhythm below. Card primitive owns radius + shadow; the fill
    // override layers on top.
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={i18n.t("running.a11y.card", { name: placeName, elapsed })}
    >
      <Card padding={4} testID={testID} style={{ backgroundColor: t.color("color.accent.soft") }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.space[3],
          }}
        >
          {/* Pulsing success-green dot reads as "live, currently tracking". */}
          <TrackingDot size={10} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: t.type.size.xs,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
              }}
            >
              {i18n.t("running.label.tracking")}{" "}
              <Text
                style={{
                  color: t.color("color.fg"),
                  fontWeight: t.type.weight.semibold,
                }}
              >
                {placeName}
              </Text>
            </Text>
            <Text
              testID={testID ? `${testID}-elapsed` : "running-timer-elapsed"}
              style={{
                fontSize: 26, // running-timer display size — intentionally above the type scale
                fontWeight: t.type.weight.bold,
                color: t.color("color.fg"),
                fontFamily: t.type.family.sans,
                letterSpacing: -0.5,
                marginTop: 2,
                fontVariant: ["tabular-nums"],
              }}
            >
              {elapsed}
            </Text>
          </View>
          <Button variant="secondary" size="sm" onPress={onStop}>
            {i18n.t("running.cta.stop")}
          </Button>
        </View>
      </Card>
    </View>
  );
}

/**
 * Returns a formatted HH:MM:SS elapsed string, updated every second. Uses
 * wall-clock math (`Date.now()`) rather than counting ticks so drift never
 * shows even if the interval fires late.
 */
function useElapsed(startedAt: number): string {
  const compute = () => Math.max(0, Math.floor(Date.now() / 1000) - startedAt);
  const [seconds, setSeconds] = useState<number>(compute);
  useEffect(() => {
    // Recompute immediately so a re-mount with a new `startedAt` re-syncs.
    setSeconds(compute);
    const id = setInterval(() => {
      setSeconds(compute);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);
  return formatElapsed(seconds);
}
