import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { DigestSection } from "./DigestSection";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

describe("DigestSection", () => {
  it("fires onToggle when the switch is pressed", () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      wrap(<DigestSection enabled hour={8} onToggle={onToggle} onChangeHour={jest.fn()} />),
    );
    fireEvent.press(getByTestId("notifications-digest-toggle"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("advertises the switch role with the current checked state", () => {
    const { getByTestId, rerender } = render(
      wrap(<DigestSection enabled hour={8} onToggle={jest.fn()} onChangeHour={jest.fn()} />),
    );
    expect(getByTestId("notifications-digest-toggle").props.accessibilityState).toEqual({
      checked: true,
    });
    rerender(
      wrap(
        <DigestSection enabled={false} hour={8} onToggle={jest.fn()} onChangeHour={jest.fn()} />,
      ),
    );
    expect(getByTestId("notifications-digest-toggle").props.accessibilityState).toEqual({
      checked: false,
    });
  });

  it("steps the hour via the HourRow increment control", () => {
    const onChangeHour = jest.fn();
    const { getByTestId } = render(
      wrap(<DigestSection enabled hour={8} onToggle={jest.fn()} onChangeHour={onChangeHour} />),
    );
    // HourRow suffixes its testID into `<id>-dec|value|inc` — incrementing
    // from hour=8 should fire 9.
    fireEvent.press(getByTestId("notifications-digest-hour-inc"));
    expect(onChangeHour).toHaveBeenCalledWith(9);
  });
});
