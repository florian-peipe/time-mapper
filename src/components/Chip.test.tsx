import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Chip } from "./Chip";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("Chip", () => {
  it("renders the label", () => {
    render(wrap(<Chip label="Unlimited places" />));
    expect(screen.getByText("Unlimited places")).toBeTruthy();
  });

  it("fires onPress when tapped", () => {
    const onPress = jest.fn();
    render(wrap(<Chip label="Home" onPress={onPress} />));
    fireEvent.press(screen.getByText("Home"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("neutral unselected uses surface2 bg + border color border", () => {
    render(wrap(<Chip testID="chip" label="All" />));
    const el = screen.getByTestId("chip");
    const s = flat(el.props.style);
    expect(s.backgroundColor).toBe("#F5F2EC"); // color.surface2 light
    expect(s.borderColor).toBe("#E9E4DD"); // color.border light
  });

  it("accent selected uses accent.soft bg + accent border", () => {
    render(wrap(<Chip testID="chip" label="Yearly" tone="accent" selected />));
    const el = screen.getByTestId("chip");
    const s = flat(el.props.style);
    expect(s.backgroundColor).toBe("#FFE7DD"); // color.accent.soft light
    expect(s.borderColor).toBe("#FF6A3D"); // color.accent light
  });

  it("renders an optional leading icon when icon prop is set", () => {
    const { toJSON } = render(wrap(<Chip label="Home" icon="home" />));
    const tree = toJSON();
    // Icon presence isn't directly queryable by label, but presence of multiple
    // children in the root proves the icon branch was taken.
    const root = Array.isArray(tree) ? tree[0] : tree;
    expect(root && (root as { children?: unknown[] }).children?.length).toBeGreaterThan(1);
  });
});
