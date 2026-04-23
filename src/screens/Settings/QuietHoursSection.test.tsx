import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { QuietHoursSection } from "./QuietHoursSection";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

describe("QuietHoursSection", () => {
  it("fires onToggle when the header pressable is tapped", () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      wrap(
        <QuietHoursSection
          enabled
          startH={22}
          endH={7}
          onToggle={onToggle}
          onChangeStart={jest.fn()}
          onChangeEnd={jest.fn()}
        />,
      ),
    );
    fireEvent.press(getByTestId("notifications-toggle"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("advertises the switch role with the current checked state", () => {
    const { getByTestId, rerender } = render(
      wrap(
        <QuietHoursSection
          enabled
          startH={22}
          endH={7}
          onToggle={jest.fn()}
          onChangeStart={jest.fn()}
          onChangeEnd={jest.fn()}
        />,
      ),
    );
    expect(getByTestId("notifications-toggle").props.accessibilityState).toEqual({ checked: true });
    rerender(
      wrap(
        <QuietHoursSection
          enabled={false}
          startH={22}
          endH={7}
          onToggle={jest.fn()}
          onChangeStart={jest.fn()}
          onChangeEnd={jest.fn()}
        />,
      ),
    );
    expect(getByTestId("notifications-toggle").props.accessibilityState).toEqual({
      checked: false,
    });
  });

  it("surfaces the range-invalid error text only when start === end AND enabled is true", () => {
    const { queryByTestId, rerender } = render(
      wrap(
        <QuietHoursSection
          enabled
          startH={22}
          endH={7}
          onToggle={jest.fn()}
          onChangeStart={jest.fn()}
          onChangeEnd={jest.fn()}
        />,
      ),
    );
    expect(queryByTestId("notifications-error")).toBeNull();

    // startH === endH while enabled → error visible.
    rerender(
      wrap(
        <QuietHoursSection
          enabled
          startH={22}
          endH={22}
          onToggle={jest.fn()}
          onChangeStart={jest.fn()}
          onChangeEnd={jest.fn()}
        />,
      ),
    );
    expect(queryByTestId("notifications-error")).toBeTruthy();

    // Equal hours but disabled → no error (can't schedule, so the equality
    // doesn't matter).
    rerender(
      wrap(
        <QuietHoursSection
          enabled={false}
          startH={22}
          endH={22}
          onToggle={jest.fn()}
          onChangeStart={jest.fn()}
          onChangeEnd={jest.fn()}
        />,
      ),
    );
    expect(queryByTestId("notifications-error")).toBeNull();
  });
});
