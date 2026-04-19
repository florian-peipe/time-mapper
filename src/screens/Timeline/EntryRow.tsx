import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, PlaceBubble, SourceChip } from "@/components";
import type { IconName, SourceKind } from "@/components";
import { i18n } from "@/lib/i18n";

type Props = {
  /** Entry id forwarded to onPress — callers usually open the edit sheet with it. */
  entryId: string;
  placeName: string;
  placeIcon: IconName;
  placeColor: string;
  source: SourceKind;
  /** Unix seconds — displayed as local HH:MM. */
  startedAt: number;
  /** Unix seconds — displayed as local HH:MM. Null = ongoing (rendered as "now"). */
  endedAt: number | null;
  /** Net minutes (gross − pause) for the right-aligned duration label. */
  netMinutes: number;
  onPress: (entryId: string) => void;
  /** Omit the bottom hairline for the last row — mirrors ListRow's `last`. */
  last?: boolean;
  testID?: string;
};

/**
 * Single entry row on the Timeline. Layout: `[PlaceBubble] [name + source
 * chip on line 1, start–end on line 2] [right-aligned duration]`.
 *
 * The entire row is tappable — opens the EntryEditSheet. We reuse `PlaceBubble`
 * (40px default) and the shared `SourceChip`; the hairline-below pattern is
 * implemented as `borderBottom`.
 */
export function EntryRow({
  entryId,
  placeName,
  placeIcon,
  placeColor,
  source,
  startedAt,
  endedAt,
  netMinutes,
  onPress,
  last,
  testID,
}: Props) {
  const t = useTheme();

  const startLabel = formatClock(startedAt);
  const endLabel = endedAt == null ? i18n.t("entryRow.ongoing") : formatClock(endedAt);
  const hours = Math.floor(netMinutes / 60);
  const minutes = netMinutes % 60;

  return (
    <Pressable
      testID={testID}
      onPress={() => onPress(entryId)}
      accessibilityRole="button"
      accessibilityLabel={`${placeName}, ${startLabel} to ${endLabel}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.space[3],
        // 14px vertical rhythm — matches ListRow.
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.color("color.border"),
      }}
    >
      <PlaceBubble icon={placeIcon} color={placeColor} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.space[2],
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: t.type.size.body,
              fontWeight: t.type.weight.medium,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              flexShrink: 1,
            }}
          >
            {placeName}
          </Text>
          <SourceChip kind={source} />
        </View>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            marginTop: 2,
            fontVariant: ["tabular-nums"],
          }}
        >
          {startLabel} – {endLabel}
        </Text>
      </View>
      <Text
        style={{
          fontSize: t.type.size.body,
          fontWeight: t.type.weight.semibold,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
          fontVariant: ["tabular-nums"],
        }}
      >
        {hours}h {String(minutes).padStart(2, "0")}m
      </Text>
      {/*
        chevron-right trailing accessory signals "this row is tappable →
        opens the edit sheet". Same affordance ListRow uses in Settings so
        the gesture vocabulary stays consistent.
      */}
      <Icon name="chevron-right" size={18} color={t.color("color.fg3")} />
    </Pressable>
  );
}

function formatClock(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${pad(h)}:${pad(m)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
