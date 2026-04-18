import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { SegmentedControl } from "./SegmentedControl";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

describe("SegmentedControl", () => {
  const options = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
  ] as const;

  it("renders all option labels", () => {
    render(wrap(<SegmentedControl value="day" onChange={() => {}} options={[...options]} />));
    expect(screen.getByText("Day")).toBeTruthy();
    expect(screen.getByText("Week")).toBeTruthy();
  });

  it("calls onChange with the new value when a segment is tapped", () => {
    const onChange = jest.fn();
    render(wrap(<SegmentedControl value="day" onChange={onChange} options={[...options]} />));
    fireEvent.press(screen.getByText("Week"));
    expect(onChange).toHaveBeenCalledWith("week");
  });

  it("does not call onChange when the selected segment is tapped again", () => {
    const onChange = jest.fn();
    render(wrap(<SegmentedControl value="day" onChange={onChange} options={[...options]} />));
    fireEvent.press(screen.getByText("Day"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports three options (e.g. month/year toggle)", () => {
    const three = [
      { value: "m", label: "Month" },
      { value: "q", label: "Quarter" },
      { value: "y", label: "Year" },
    ];
    const onChange = jest.fn();
    render(wrap(<SegmentedControl value="m" onChange={onChange} options={three} />));
    fireEvent.press(screen.getByText("Year"));
    expect(onChange).toHaveBeenCalledWith("y");
  });

  it("marks the selected segment via accessibilityState", () => {
    render(wrap(<SegmentedControl value="week" onChange={() => {}} options={[...options]} />));
    const week = screen.getByRole("button", { name: "Week" });
    expect(week.props.accessibilityState.selected).toBe(true);
  });
});
