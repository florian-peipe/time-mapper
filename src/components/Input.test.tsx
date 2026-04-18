import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Input } from "./Input";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("Input", () => {
  it("renders a text input that receives typed characters", () => {
    const onChangeText = jest.fn();
    render(wrap(<Input testID="field" value="" onChangeText={onChangeText} />));
    fireEvent.changeText(screen.getByTestId("field"), "hello");
    expect(onChangeText).toHaveBeenCalledWith("hello");
  });

  it("renders at 48px tall with md radius per design-system inputStyle", () => {
    render(wrap(<Input testID="field" />));
    const input = screen.getByTestId("field");
    const s = flat(input.props.style);
    expect(s.height).toBe(48);
    // radius.md = 12
    expect(s.borderRadius).toBe(12);
  });

  it("uses the default border color when not invalid and unfocused", () => {
    render(wrap(<Input testID="field" />));
    const input = screen.getByTestId("field");
    const s = flat(input.props.style);
    // tokens.light["color.border"] = #E9E4DD
    expect(s.borderColor).toBe("#E9E4DD");
  });

  it("switches borderColor to color.danger when invalid", () => {
    render(wrap(<Input testID="field" invalid />));
    const input = screen.getByTestId("field");
    const s = flat(input.props.style);
    // tokens.light["color.danger"] = #C4361E
    expect(s.borderColor).toBe("#C4361E");
  });

  it("switches borderColor to border.strong on focus", () => {
    render(wrap(<Input testID="field" />));
    const input = screen.getByTestId("field");
    fireEvent(input, "focus");
    const s = flat(input.props.style);
    // tokens.light["color.border.strong"] = #D7CFC2
    expect(s.borderColor).toBe("#D7CFC2");
  });

  it("reserves left space for a leading icon when leading is provided", () => {
    render(wrap(<Input testID="field" leading="search" />));
    const input = screen.getByTestId("field");
    const s = flat(input.props.style);
    // 42 matches Screens.jsx AddPlaceSheet search paddingLeft: 42
    expect(s.paddingLeft).toBe(42);
  });

  it("renders the error message when error prop is provided", () => {
    render(wrap(<Input testID="field" error="Invalid time format" />));
    expect(screen.getByText("Invalid time format")).toBeTruthy();
  });

  it("applies the danger border when error is a non-empty string", () => {
    render(wrap(<Input testID="field" error="bad" />));
    const input = screen.getByTestId("field");
    const s = flat(input.props.style);
    // tokens.light["color.danger"] = #C4361E
    expect(s.borderColor).toBe("#C4361E");
  });

  it("does not render error text when error is undefined", () => {
    render(wrap(<Input testID="field" />));
    // No error region should appear — the message is absent.
    expect(screen.queryByTestId("field-error")).toBeNull();
  });
});
