import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { TextArea } from "./TextArea";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("TextArea", () => {
  it("renders a multiline input and calls onChangeText", () => {
    const onChangeText = jest.fn();
    render(wrap(<TextArea testID="note" onChangeText={onChangeText} />));
    const input = screen.getByTestId("note");
    expect(input.props.multiline).toBe(true);
    fireEvent.changeText(input, "hello world");
    expect(onChangeText).toHaveBeenCalledWith("hello world");
  });

  it("applies a 3-line default minHeight derived from body font size", () => {
    render(wrap(<TextArea testID="note" />));
    const input = screen.getByTestId("note");
    const s = flat(input.props.style);
    // body font size is 15 + small vertical rhythm. We expect >= 3 * 15 = 45.
    expect(Number(s.minHeight)).toBeGreaterThanOrEqual(45);
  });

  it("honors a custom minHeightLines prop", () => {
    render(wrap(<TextArea testID="note" minHeightLines={5} />));
    const input = screen.getByTestId("note");
    const s = flat(input.props.style);
    // Expect minHeight to be notably bigger than the 3-line default.
    expect(Number(s.minHeight)).toBeGreaterThanOrEqual(5 * 15);
  });

  it("grows via onContentSizeChange up to the cap", () => {
    render(wrap(<TextArea testID="note" maxHeightLines={3} minHeightLines={2} />));
    const input = screen.getByTestId("note");

    fireEvent(input, "contentSizeChange", {
      nativeEvent: { contentSize: { width: 200, height: 400 } },
    });

    // The rendered height should clamp to <= 3 lines worth of body
    // (3 * ~24px line height = 72; allow some slack via maxHeight check).
    const s = flat(input.props.style);
    expect(Number(s.height)).toBeLessThanOrEqual(Number(s.maxHeight));
    expect(Number(s.height)).toBeGreaterThan(Number(s.minHeight));
  });

  it("switches borderColor to color.danger when invalid", () => {
    render(wrap(<TextArea testID="note" invalid />));
    const input = screen.getByTestId("note");
    const s = flat(input.props.style);
    // tokens.light["color.danger"] = #C4361E
    expect(s.borderColor).toBe("#C4361E");
  });
});
