import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { SourceChip } from "./SourceChip";

const wrap = (ui: React.ReactNode, scheme: "light" | "dark" = "light") => (
  <ThemeProvider schemeOverride={scheme}>{ui}</ThemeProvider>
);

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("SourceChip", () => {
  it("renders AUTO label for kind=auto", () => {
    render(wrap(<SourceChip kind="auto" />));
    expect(screen.getByText("AUTO")).toBeTruthy();
  });

  it("renders MANUAL label for kind=manual", () => {
    render(wrap(<SourceChip kind="manual" />));
    expect(screen.getByText("MANUAL")).toBeTruthy();
  });

  it("uses chip.auto.bg token color in light scheme", () => {
    const { toJSON } = render(wrap(<SourceChip kind="auto" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    // light chip.auto.bg is #EEF5FF
    expect(s.backgroundColor).toBe("#EEF5FF");
  });

  it("uses chip.manual.bg token color in light scheme", () => {
    const { toJSON } = render(wrap(<SourceChip kind="manual" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    // light chip.manual.bg is #F2EEE8
    expect(s.backgroundColor).toBe("#F2EEE8");
  });

  it("uses dark scheme chip colors when in dark mode", () => {
    const { toJSON } = render(wrap(<SourceChip kind="auto" />, "dark"));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    // dark chip.auto.bg is #13243A
    expect(s.backgroundColor).toBe("#13243A");
  });
});
