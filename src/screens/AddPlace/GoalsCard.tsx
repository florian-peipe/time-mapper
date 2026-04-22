import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { GoalSliderRow } from "./GoalSliderRow";
import {
  DAILY_GOAL_MIN_H,
  DAILY_GOAL_MAX_H,
  WEEKLY_GOAL_MIN_H,
  WEEKLY_GOAL_MAX_H,
} from "./usePlaceForm";

/**
 * Daily + weekly goal pair with an explanatory header. Rendered as a Fragment
 * so the header View and the two GoalSliderRow instances remain direct
 * children of Phase2DetailsForm's outer column, preserving inter-section gaps
 * one-for-one with the pre-refactor layout.
 */
export function GoalsCard({
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
}: {
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
}) {
  const t = useTheme();
  return (
    <>
      {/* Goals — optional daily + weekly time targets. */}
      <View style={{ gap: t.space[2] }}>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
          }}
        >
          {i18n.t("addPlace.goals.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.xs,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
          }}
        >
          {i18n.t("addPlace.goals.body")}
        </Text>
      </View>
      <GoalSliderRow
        label={i18n.t("addPlace.goals.daily")}
        enabled={dailyGoalEnabled}
        hours={dailyGoalHours}
        minValue={DAILY_GOAL_MIN_H}
        maxValue={DAILY_GOAL_MAX_H}
        onToggle={onChangeDailyGoalEnabled}
        onChangeHours={onChangeDailyGoalHours}
        daysValue={dailyGoalDays}
        onDaysChange={onChangeDailyGoalDays}
        testID="add-place-daily-goal"
      />
      <GoalSliderRow
        label={i18n.t("addPlace.goals.weekly")}
        enabled={weeklyGoalEnabled}
        hours={weeklyGoalHours}
        minValue={WEEKLY_GOAL_MIN_H}
        maxValue={WEEKLY_GOAL_MAX_H}
        onToggle={onChangeWeeklyGoalEnabled}
        onChangeHours={onChangeWeeklyGoalHours}
        testID="add-place-weekly-goal"
      />
    </>
  );
}
