import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PlaceBubble } from "./PlaceBubble";

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>
);

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("PlaceBubble", () => {
  it("renders a circle with the provided color background", () => {
    const { toJSON } = render(wrap(<PlaceBubble icon="home" color="#FF6A3D" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.backgroundColor).toBe("#FF6A3D");
    expect(s.width).toBe(42);
    expect(s.height).toBe(42);
    expect(s.borderRadius).toBe(9999); // pill / full circle
  });

  it("uses custom size when provided", () => {
    const { toJSON } = render(<ThemeProvider schemeOverride="light">
      <PlaceBubble icon="briefcase" color="#1D7FD1" size={64} />
    </ThemeProvider>);
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.width).toBe(64);
    expect(s.height).toBe(64);
  });

  it("renders the lucide icon as a child", () => {
    const { toJSON } = render(wrap(<PlaceBubble icon="dumbbell" color="#2E9A5E" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    expect(root && (root as { children?: unknown[] }).children?.length).toBeGreaterThan(0);
  });
});
