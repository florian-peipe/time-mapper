import React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { resetProMock, useProMock } from "@/features/billing/useProMock";
import { PaywallScreen } from "./PaywallScreen";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

beforeEach(() => {
  resetProMock();
});

describe("PaywallScreen", () => {
  it("renders the headline and subhead", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("Track every place that matters.")).toBeTruthy();
    expect(
      screen.getByText("Pro gives you unlimited places, full history, CSV export, and categories."),
    ).toBeTruthy();
  });

  it("renders all five feature bullets", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("Unlimited places")).toBeTruthy();
    expect(screen.getByText("Full history (no 14-day limit)")).toBeTruthy();
    expect(screen.getByText("Weekly reports for past weeks")).toBeTruthy();
    expect(screen.getByText("CSV export")).toBeTruthy();
    expect(screen.getByText("Place categories")).toBeTruthy();
  });

  it("renders both plan cards with their prices and the yearly badge", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByTestId("plan-card-year")).toBeTruthy();
    expect(screen.getByTestId("plan-card-month")).toBeTruthy();
    expect(screen.getByText("Yearly")).toBeTruthy();
    expect(screen.getByText("Monthly")).toBeTruthy();
    expect(screen.getByText("€29.99")).toBeTruthy();
    expect(screen.getByText("€4.99")).toBeTruthy();
    expect(screen.getByText("Save 50%")).toBeTruthy();
  });

  it("yearly is selected by default", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    const yearCard = screen.getByTestId("plan-card-year");
    const monthCard = screen.getByTestId("plan-card-month");
    expect(yearCard.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(monthCard.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("CTA reads 'Start free trial' when yearly is selected", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    const cta = screen.getByTestId("paywall-cta");
    expect(cta).toBeTruthy();
    expect(screen.getByText("Start free trial")).toBeTruthy();
  });

  it("tapping Monthly switches the selection and re-labels the CTA", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    fireEvent.press(screen.getByTestId("plan-card-month"));

    const monthCard = screen.getByTestId("plan-card-month");
    const yearCard = screen.getByTestId("plan-card-year");
    expect(monthCard.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(yearCard.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    expect(screen.getByText("Subscribe")).toBeTruthy();
  });

  it("tapping Yearly after Monthly returns to the trial CTA", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    fireEvent.press(screen.getByTestId("plan-card-month"));
    expect(screen.getByText("Subscribe")).toBeTruthy();
    fireEvent.press(screen.getByTestId("plan-card-year"));
    expect(screen.getByText("Start free trial")).toBeTruthy();
  });

  it("renders the footer caption", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("Restore purchases · Terms · Privacy")).toBeTruthy();
  });

  it("tapping the CTA grants Pro and calls onClose", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(wrap(<PaywallScreen onClose={onClose} />));
    // Capture the CTA reference before we tear down the tree to probe state.
    const cta = getByTestId("paywall-cta");
    fireEvent.press(cta);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(readIsPro()).toBe(true);
  });

  it("tapping the close (X) button calls onClose without granting Pro", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(wrap(<PaywallScreen onClose={onClose} />));
    fireEvent.press(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(readIsPro()).toBe(false);
  });

  it("accepts an optional `source` prop without rendering it", () => {
    render(wrap(<PaywallScreen onClose={() => {}} source="settings" />));
    // The source isn't surfaced visually in Plan 2; just confirm no crash
    // and the headline is still present.
    expect(screen.getByText("Track every place that matters.")).toBeTruthy();
  });
});

/**
 * Read the live `useProMock().isPro` value without disturbing the screen
 * under test. `renderHook` runs the hook in an isolated tree and returns
 * the latest value — useful for inspecting the shared zustand store after
 * the screen has fired its grant() side-effect.
 */
function readIsPro(): boolean {
  const { result, unmount } = renderHook(() => useProMock());
  const value = result.current.isPro;
  unmount();
  return value;
}
