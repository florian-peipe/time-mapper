import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useSheetStore } from "@/state/sheetStore";
import * as openPaywallModule from "@/features/billing/openPaywall";
import { DayNavHeader, FREE_HISTORY_DAYS } from "./DayNavHeader";
import { _resetRateLimit } from "./dayNavGuard";
import type { RangeMode } from "@/lib/range";

type MountProps = {
  mode?: RangeMode;
  offset: number;
  isPro?: boolean;
  onChangeMode?: (m: RangeMode) => void;
  onChangeOffset?: (n: number) => void;
};

function mount(props: MountProps) {
  const onChangeMode = props.onChangeMode ?? jest.fn();
  const onChangeOffset = props.onChangeOffset ?? jest.fn();
  const utils = render(
    <ThemeProvider schemeOverride="light">
      <DayNavHeader
        mode={props.mode ?? "day"}
        offset={props.offset}
        totalMin={120}
        isPro={props.isPro}
        onChangeMode={onChangeMode}
        onChangeOffset={onChangeOffset}
        testID="day-nav-header"
      />
    </ThemeProvider>,
  );
  return { ...utils, onChangeMode, onChangeOffset };
}

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
  _resetRateLimit();
  jest.restoreAllMocks();
});

describe("DayNavHeader", () => {
  it("renders with a prev + next chevron and a tracked-time readout", () => {
    mount({ offset: 0 });
    expect(screen.getByTestId("day-nav-header")).toBeTruthy();
    expect(screen.getByTestId("day-nav-header-prev")).toBeTruthy();
    expect(screen.getByTestId("day-nav-header-next")).toBeTruthy();
    expect(screen.getByText(/2h 0m tracked/)).toBeTruthy();
  });

  it("disables the next chevron when already on the current period", () => {
    mount({ offset: 0 });
    const next = screen.getByTestId("day-nav-header-next");
    expect(next.props.accessibilityState?.disabled).toBe(true);
  });

  it("navigates backward in day mode when not yet at the gate", () => {
    const { onChangeOffset } = mount({ offset: -3, isPro: false });
    fireEvent.press(screen.getByTestId("day-nav-header-prev"));
    expect(onChangeOffset).toHaveBeenCalledWith(-4);
  });

  it("opens the paywall instead of navigating when a free user steps past the free-history limit", () => {
    const spy = jest.spyOn(openPaywallModule, "openPaywall").mockImplementation(() => undefined);
    const { onChangeOffset } = mount({ offset: -FREE_HISTORY_DAYS, isPro: false });
    fireEvent.press(screen.getByTestId("day-nav-header-prev"));
    expect(onChangeOffset).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ source: "history" });
  });

  it("Pro users can step past the 14-day limit without the paywall", () => {
    const spy = jest.spyOn(openPaywallModule, "openPaywall").mockImplementation(() => undefined);
    const { onChangeOffset } = mount({ offset: -FREE_HISTORY_DAYS, isPro: true });
    fireEvent.press(screen.getByTestId("day-nav-header-prev"));
    expect(onChangeOffset).toHaveBeenCalledWith(-FREE_HISTORY_DAYS - 1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("meets the 44pt minimum touch-target on prev + next", () => {
    mount({ offset: 0 });
    const prev = screen.getByTestId("day-nav-header-prev");
    const next = screen.getByTestId("day-nav-header-next");
    expect(prev.props.style).toMatchObject(
      expect.objectContaining({ minWidth: 44, minHeight: 44 }),
    );
    expect(next.props.style[0]).toMatchObject(
      expect.objectContaining({ minWidth: 44, minHeight: 44 }),
    );
  });

  it("tapping the label opens the date-picker sheet", () => {
    mount({ offset: 0 });
    fireEvent.press(screen.getByTestId("day-nav-header-mode"));
    expect(screen.getByText("Go to date")).toBeTruthy();
  });

  it("long-pressing the label cycles the aggregation mode forward", () => {
    const { onChangeMode, onChangeOffset } = mount({ offset: -3, mode: "day" });
    fireEvent(screen.getByTestId("day-nav-header-mode"), "longPress");
    expect(onChangeMode).toHaveBeenCalledWith("week");
    expect(onChangeOffset).toHaveBeenCalledWith(0);
  });

  it("shows a 'Today' chip when offset is non-zero and hides it at offset 0", () => {
    const { rerender } = mount({ offset: -2 });
    expect(screen.getByTestId("day-nav-header-today")).toBeTruthy();
    rerender(
      <ThemeProvider schemeOverride="light">
        <DayNavHeader
          mode="day"
          offset={0}
          totalMin={120}
          isPro={false}
          onChangeMode={jest.fn()}
          onChangeOffset={jest.fn()}
          testID="day-nav-header"
        />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId("day-nav-header-today")).toBeNull();
  });

  it("shows 'This week' in week mode at offset 0", () => {
    mount({ offset: 0, mode: "week" });
    expect(screen.getByText("This week")).toBeTruthy();
  });

  it("shows 'This month' in month mode at offset 0", () => {
    mount({ offset: 0, mode: "month" });
    expect(screen.getByText("This month")).toBeTruthy();
  });

  it("shows 'This year' in year mode at offset 0", () => {
    mount({ offset: 0, mode: "year" });
    expect(screen.getByText("This year")).toBeTruthy();
  });
});
