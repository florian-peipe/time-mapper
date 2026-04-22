import React from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { PLACE_COLORS } from "@/theme/tokens";
import { i18n } from "@/lib/i18n";
import { AddressPreviewCard } from "./AddressPreviewCard";
import { AppearanceCard } from "./AppearanceCard";
import { BuffersCard } from "./BuffersCard";
import { GoalsCard } from "./GoalsCard";
import type { Selection } from "./usePlaceForm";

/**
 * Phase-2 of the AddPlaceSheet: the full editor once the user has picked
 * (or is editing) a place. A thin vertical orchestrator over purpose-built
 * sub-cards (address, appearance, buffers, goals) plus the radius slider
 * kept inline — it's a single control and doesn't earn its own file.
 *
 * Render order matches the pre-split layout one-for-one so the snapshot
 * test and a11y assertions stay green.
 */

const RADIUS_MIN = 25;
const RADIUS_MAX = 300;

export type Phase2DetailsFormProps = {
  /** Remount key for native sliders — forwarded from `sheet.visible`. */
  visible: boolean;
  selected: Selection;
  name: string;
  onChangeName: (v: string) => void;
  radius: number;
  onChangeRadius: (v: number) => void;
  colorIdx: number;
  onChangeColorIdx: (v: number) => void;
  iconIdx: number;
  onChangeIconIdx: (v: number) => void;
  entryBufferMin: number;
  onChangeEntryBufferMin: (v: number) => void;
  exitBufferMin: number;
  onChangeExitBufferMin: (v: number) => void;
  dailyGoalEnabled: boolean;
  onChangeDailyGoalEnabled: (v: boolean) => void;
  dailyGoalHours: number;
  onChangeDailyGoalHours: (v: number) => void;
  dailyGoalDays: number[];
  onChangeDailyGoalDays: (v: number[]) => void;
  weeklyGoalEnabled: boolean;
  onChangeWeeklyGoalEnabled: (v: boolean) => void;
  weeklyGoalHours: number;
  onChangeWeeklyGoalHours: (v: number) => void;
};

export function Phase2DetailsForm({
  visible,
  selected,
  name,
  onChangeName,
  radius,
  onChangeRadius,
  colorIdx,
  onChangeColorIdx,
  iconIdx,
  onChangeIconIdx,
  entryBufferMin,
  onChangeEntryBufferMin,
  exitBufferMin,
  onChangeExitBufferMin,
  dailyGoalEnabled,
  onChangeDailyGoalEnabled,
  dailyGoalHours,
  onChangeDailyGoalHours,
  dailyGoalDays,
  onChangeDailyGoalDays,
  weeklyGoalEnabled,
  onChangeWeeklyGoalEnabled,
  weeklyGoalHours,
  onChangeWeeklyGoalHours,
}: Phase2DetailsFormProps) {
  const t = useTheme();
  const chosenColor = PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0]!;
  return (
    <View style={{ flexDirection: "column", gap: t.space[5] - 2 }}>
      <AddressPreviewCard
        selected={selected}
        name={name}
        onChangeName={onChangeName}
        radius={radius}
        chosenColor={chosenColor}
      />

      {/* Radius slider — single control, kept inline. */}
      <View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: t.space[2],
          }}
        >
          <Text
            accessibilityRole="text"
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg2"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.medium,
            }}
          >
            {i18n.t("addPlace.field.radius")}
          </Text>
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              fontVariant: ["tabular-nums"],
            }}
          >
            {radius} m
          </Text>
        </View>
        <Slider
          key={visible ? "radius-open" : "radius-closed"}
          testID="add-place-radius"
          minimumValue={RADIUS_MIN}
          maximumValue={RADIUS_MAX}
          step={1}
          value={radius}
          onValueChange={(v: number) => onChangeRadius(Math.round(v))}
          minimumTrackTintColor={t.color("color.accent")}
          maximumTrackTintColor={t.color("color.border")}
          thumbTintColor={t.color("color.accent")}
          style={{ width: "100%", height: 28 }}
          accessibilityRole="adjustable"
          accessibilityLabel={i18n.t("addPlace.field.radius")}
          accessibilityValue={{
            min: RADIUS_MIN,
            max: RADIUS_MAX,
            now: radius,
            text: `${radius} m`,
          }}
          accessibilityHint={i18n.t("addPlace.field.radius.hint")}
        />
      </View>

      <BuffersCard
        entryBufferMin={entryBufferMin}
        onChangeEntryBufferMin={onChangeEntryBufferMin}
        exitBufferMin={exitBufferMin}
        onChangeExitBufferMin={onChangeExitBufferMin}
        visible={visible}
      />

      <GoalsCard
        dailyGoalEnabled={dailyGoalEnabled}
        onChangeDailyGoalEnabled={onChangeDailyGoalEnabled}
        dailyGoalHours={dailyGoalHours}
        onChangeDailyGoalHours={onChangeDailyGoalHours}
        dailyGoalDays={dailyGoalDays}
        onChangeDailyGoalDays={onChangeDailyGoalDays}
        weeklyGoalEnabled={weeklyGoalEnabled}
        onChangeWeeklyGoalEnabled={onChangeWeeklyGoalEnabled}
        weeklyGoalHours={weeklyGoalHours}
        onChangeWeeklyGoalHours={onChangeWeeklyGoalHours}
      />

      <AppearanceCard
        colorIdx={colorIdx}
        onChangeColorIdx={onChangeColorIdx}
        iconIdx={iconIdx}
        onChangeIconIdx={onChangeIconIdx}
        chosenColor={chosenColor}
      />
    </View>
  );
}
