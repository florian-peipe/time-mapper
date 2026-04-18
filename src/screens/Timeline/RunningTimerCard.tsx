import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Card } from "@/components";

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
 * elapsed clock. Source: design-system Screens.jsx → TimelineScreen
 * `running && today` block.
 *
 * Why a local `setInterval` rather than reactive time-of-day:
 * - We only need to tick while this card is on-screen; `useEffect` cleanup
 *   handles unmount and the Timeline mounts/unmounts the card based on
 *   `useOngoingEntry()`.
 * - No shared ticking source exists yet (Plan 3+ may introduce a
 *   `useClock(1000)` hook if other screens need it).
 */
export function RunningTimerCard({ placeName, startedAt, onStop, testID }: Props) {
  const t = useTheme();
  const elapsed = useElapsed(startedAt);

  return (
    <Card variant="tile" padding={4} testID={testID}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: t.space[3],
        }}
      >
        {/* 10px accent dot per design-system Screens.jsx running block. */}
        <View
          accessible={false}
          style={{
            width: 10, // static dot, design-system 10x10
            height: 10, // static dot, design-system 10x10
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.accent"),
          }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.medium,
            }}
          >
            Tracking{" "}
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
              fontSize: 26, // design-system spec: 26px running-timer size, no token
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
          Stop
        </Button>
      </View>
    </Card>
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

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
