import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Banner } from "./Banner";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("Banner", () => {
  it("renders the title", () => {
    render(wrap(<Banner tone="info" title="Heads up" />));
    expect(screen.getByText("Heads up")).toBeTruthy();
  });

  it("renders optional body when provided", () => {
    render(wrap(<Banner tone="info" title="Heads up" body="Details here." />));
    expect(screen.getByText("Details here.")).toBeTruthy();
  });

  it("uses the chip.auto pair for the info tone (design-system 'do not invent hues' rule)", () => {
    render(wrap(<Banner testID="b" tone="info" title="FYI" />));
    const el = screen.getByTestId("b");
    const s = flat(el.props.style);
    // tokens.light["color.chip.auto.bg"] = #EEF5FF
    expect(s.backgroundColor).toBe("#EEF5FF");
    // tokens.light["color.chip.auto.fg"] = #1D4E89 → used for border
    expect(s.borderColor).toBe("#1D4E89");
  });

  it("uses warning.soft bg for warning tone", () => {
    render(wrap(<Banner testID="b" tone="warning" title="Permission off" />));
    const el = screen.getByTestId("b");
    const s = flat(el.props.style);
    // tokens.light["color.warning.soft"] = #FBF0D7
    expect(s.backgroundColor).toBe("#FBF0D7");
  });

  it("uses danger.soft bg for danger tone", () => {
    render(wrap(<Banner testID="b" tone="danger" title="Location denied" />));
    const el = screen.getByTestId("b");
    const s = flat(el.props.style);
    // tokens.light["color.danger.soft"] = #FBE4E0
    expect(s.backgroundColor).toBe("#FBE4E0");
  });

  it("fires action.onPress when the action button is tapped", () => {
    const onPress = jest.fn();
    render(wrap(<Banner tone="info" title="Info" action={{ label: "Open settings", onPress }} />));
    fireEvent.press(screen.getByText("Open settings"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
