import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Phase2DetailsForm } from "./Phase2DetailsForm";
import type { Selection } from "./usePlaceForm";

const SELECTED: Selection = {
  description: "Kinkelstr. 3, 50733 Köln",
  latitude: 50.9613,
  longitude: 6.9585,
};

const baseProps = {
  visible: true,
  selected: SELECTED,
  name: "Home",
  onChangeName: jest.fn(),
  radius: 100,
  onChangeRadius: jest.fn(),
  colorIdx: 0,
  onChangeColorIdx: jest.fn(),
  iconIdx: 0,
  onChangeIconIdx: jest.fn(),
  entryBufferMin: 5,
  onChangeEntryBufferMin: jest.fn(),
  exitBufferMin: 3,
  onChangeExitBufferMin: jest.fn(),
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

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

describe("Phase2DetailsForm", () => {
  it("renders the radius slider with adjustable role + value announcement", () => {
    const { getByTestId } = render(wrap(<Phase2DetailsForm {...baseProps} />));
    const slider = getByTestId("add-place-radius");
    expect(slider.props.accessibilityRole).toBe("adjustable");
    expect(slider.props.accessibilityValue).toEqual(
      expect.objectContaining({ now: 100, min: 25, max: 300 }),
    );
  });

  it("rounds slider values before forwarding to onChangeRadius", () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      wrap(<Phase2DetailsForm {...baseProps} onChangeRadius={onChange} />),
    );
    fireEvent(getByTestId("add-place-radius"), "valueChange", 137.6);
    expect(onChange).toHaveBeenCalledWith(138);
  });

  it("composes address, goals, buffers, and appearance sub-sections", () => {
    const { getByTestId } = render(wrap(<Phase2DetailsForm {...baseProps} />));
    // One touchstone testID per sub-card; GoalSliderRow suffixes its testID
    // prop with `-toggle` on the outer Pressable.
    expect(getByTestId("add-place-daily-goal-toggle")).toBeTruthy();
    expect(getByTestId("add-place-weekly-goal-toggle")).toBeTruthy();
    expect(getByTestId("add-place-radius")).toBeTruthy();
  });
});
