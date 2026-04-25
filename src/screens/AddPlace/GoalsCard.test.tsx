import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { GoalsCard } from "./GoalsCard";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

const base = {
  dailyGoalEnabled: false,
  onChangeDailyGoalEnabled: jest.fn(),
  dailyGoalHours: 2,
  onChangeDailyGoalHours: jest.fn(),
  dailyGoalDays: [1, 2, 3, 4, 5],
  onChangeDailyGoalDays: jest.fn(),
  weeklyGoalEnabled: false,
  onChangeWeeklyGoalEnabled: jest.fn(),
  weeklyGoalHours: 10,
  onChangeWeeklyGoalHours: jest.fn(),
};

describe("GoalsCard", () => {
  it("renders both the daily and weekly goal sliders", () => {
    const { getByTestId } = render(wrap(<GoalsCard {...base} />));
    expect(getByTestId("add-place-daily-goal-toggle")).toBeTruthy();
    expect(getByTestId("add-place-weekly-goal-toggle")).toBeTruthy();
  });

  it("flipping the daily toggle forwards the new enabled state", () => {
    const onChangeDaily = jest.fn();
    const { getByTestId } = render(
      wrap(<GoalsCard {...base} onChangeDailyGoalEnabled={onChangeDaily} />),
    );
    fireEvent.press(getByTestId("add-place-daily-goal-toggle"));
    expect(onChangeDaily).toHaveBeenCalledWith(true);
  });

  it("flipping the weekly toggle is independent of the daily toggle", () => {
    const onChangeDaily = jest.fn();
    const onChangeWeekly = jest.fn();
    const { getByTestId } = render(
      wrap(
        <GoalsCard
          {...base}
          onChangeDailyGoalEnabled={onChangeDaily}
          onChangeWeeklyGoalEnabled={onChangeWeekly}
        />,
      ),
    );
    fireEvent.press(getByTestId("add-place-weekly-goal-toggle"));
    expect(onChangeWeekly).toHaveBeenCalledWith(true);
    expect(onChangeDaily).not.toHaveBeenCalled();
  });
});
