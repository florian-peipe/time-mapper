import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useSheetStore } from "@/state/sheetStore";
import { DayNavHeader, FREE_HISTORY_DAYS } from "./DayNavHeader";

function mount(props: { dayOffset: number; isPro?: boolean; onChangeDay?: (n: number) => void }) {
  const onChangeDay = props.onChangeDay ?? jest.fn();
  const utils = render(
    <ThemeProvider schemeOverride="light">
      <DayNavHeader
        dayOffset={props.dayOffset}
        totalMin={120}
        isPro={props.isPro}
        onChangeDay={onChangeDay}
        testID="day-nav-header"
      />
    </ThemeProvider>,
  );
  return { ...utils, onChangeDay };
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
});

describe("DayNavHeader", () => {
  it("renders with a prev + next chevron and a tracked-time readout", () => {
    mount({ dayOffset: 0 });
    expect(screen.getByTestId("day-nav-header")).toBeTruthy();
    expect(screen.getByTestId("day-nav-header-prev")).toBeTruthy();
    expect(screen.getByTestId("day-nav-header-next")).toBeTruthy();
    expect(screen.getByText(/2h 0m tracked/)).toBeTruthy();
  });

  it("disables the next chevron when already on today", () => {
    mount({ dayOffset: 0 });
    const next = screen.getByTestId("day-nav-header-next");
    expect(next.props.accessibilityState?.disabled).toBe(true);
  });

  it("navigates backward with goBack when not yet at the gate", () => {
    const { onChangeDay } = mount({ dayOffset: -3, isPro: false });
    fireEvent.press(screen.getByTestId("day-nav-header-prev"));
    expect(onChangeDay).toHaveBeenCalledWith(-4);
  });

  it("opens the paywall instead of navigating when a free user steps past the free-history limit", () => {
    const { onChangeDay } = mount({ dayOffset: -FREE_HISTORY_DAYS, isPro: false });
    fireEvent.press(screen.getByTestId("day-nav-header-prev"));
    expect(onChangeDay).not.toHaveBeenCalled();
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toEqual({ source: "history" });
  });

  it("Pro users can step past the 14-day limit without the paywall", () => {
    const { onChangeDay } = mount({ dayOffset: -FREE_HISTORY_DAYS, isPro: true });
    fireEvent.press(screen.getByTestId("day-nav-header-prev"));
    expect(onChangeDay).toHaveBeenCalledWith(-FREE_HISTORY_DAYS - 1);
    expect(useSheetStore.getState().active).toBeNull();
  });

  it("meets the 44pt minimum touch-target on prev + next", () => {
    mount({ dayOffset: 0 });
    const prev = screen.getByTestId("day-nav-header-prev");
    const next = screen.getByTestId("day-nav-header-next");
    expect(prev.props.style).toMatchObject(
      expect.objectContaining({ minWidth: 44, minHeight: 44 }),
    );
    expect(next.props.style[0]).toMatchObject(
      expect.objectContaining({ minWidth: 44, minHeight: 44 }),
    );
  });
});
