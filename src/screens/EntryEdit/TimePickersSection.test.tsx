import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { TimePickersSection } from "./TimePickersSection";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

/** Matches the helper used in EntryEditSheet.test.tsx. */
function fireChange(view: unknown, next: Date) {
  act(() => {
    fireEvent(view as object, "change", { type: "set" }, next);
  });
}

describe("TimePickersSection", () => {
  const start = new Date(2026, 3, 17, 9, 0, 0);
  const end = new Date(2026, 3, 17, 10, 0, 0);
  const pause = new Date(0);

  it("renders all four picker rows (date, start, end, pause)", () => {
    const { getByTestId } = render(
      wrap(
        <TimePickersSection
          startDate={start}
          endDate={end}
          pauseDate={pause}
          onStartDateChange={jest.fn()}
          onEndDateChange={jest.fn()}
          onPauseDateChange={jest.fn()}
        />,
      ),
    );
    expect(getByTestId("entry-edit-date")).toBeTruthy();
    expect(getByTestId("entry-edit-start")).toBeTruthy();
    expect(getByTestId("entry-edit-end")).toBeTruthy();
    expect(getByTestId("entry-edit-pause")).toBeTruthy();
  });

  it("date change rolls both start AND end to the new calendar day, preserving their clock times", () => {
    const onStart = jest.fn();
    const onEnd = jest.fn();
    const { getByTestId } = render(
      wrap(
        <TimePickersSection
          startDate={start}
          endDate={end}
          pauseDate={pause}
          onStartDateChange={onStart}
          onEndDateChange={onEnd}
          onPauseDateChange={jest.fn()}
        />,
      ),
    );
    // Change the date portion to April 20 — the hours/minutes on the picker
    // itself are ignored by the onChange handler, only the date is consumed.
    fireChange(getByTestId("entry-edit-date"), new Date(2026, 3, 20, 0, 0, 0));
    const newStart = onStart.mock.calls[0]![0] as Date;
    const newEnd = onEnd.mock.calls[0]![0] as Date;
    expect(newStart.getDate()).toBe(20);
    expect(newStart.getHours()).toBe(9); // clock time preserved
    expect(newEnd.getDate()).toBe(20);
    expect(newEnd.getHours()).toBe(10);
  });

  it("start-time change fires onStartDateChange with the new Date", () => {
    const onStart = jest.fn();
    const { getByTestId } = render(
      wrap(
        <TimePickersSection
          startDate={start}
          endDate={end}
          pauseDate={pause}
          onStartDateChange={onStart}
          onEndDateChange={jest.fn()}
          onPauseDateChange={jest.fn()}
        />,
      ),
    );
    const newStart = new Date(2026, 3, 17, 11, 30, 0);
    fireChange(getByTestId("entry-edit-start"), newStart);
    expect(onStart).toHaveBeenCalledWith(newStart);
  });

  it("dismissed change events (type !== 'set') are ignored", () => {
    const onStart = jest.fn();
    const { getByTestId } = render(
      wrap(
        <TimePickersSection
          startDate={start}
          endDate={end}
          pauseDate={pause}
          onStartDateChange={onStart}
          onEndDateChange={jest.fn()}
          onPauseDateChange={jest.fn()}
        />,
      ),
    );
    act(() => {
      fireEvent(getByTestId("entry-edit-start"), "change", { type: "dismissed" }, undefined);
    });
    expect(onStart).not.toHaveBeenCalled();
  });
});
