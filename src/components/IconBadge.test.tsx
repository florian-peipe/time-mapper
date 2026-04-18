import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { IconBadge } from "./IconBadge";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("IconBadge", () => {
  it("renders a 30x30 squircle with sm radius by default", () => {
    const { toJSON } = render(wrap(<IconBadge icon="home" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.width).toBe(30);
    expect(s.height).toBe(30);
    // tokens.radius.sm = 6
    expect(s.borderRadius).toBe(6);
  });

  it("uses provided bg color when passed", () => {
    const { toJSON } = render(wrap(<IconBadge icon="map-pin" bg="#E3F4EA" color="#2E9A5E" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.backgroundColor).toBe("#E3F4EA");
  });

  it("falls back to surface2 bg when no bg provided", () => {
    const { toJSON } = render(wrap(<IconBadge icon="clock" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    // tokens.light["color.surface2"] = #F5F2EC
    expect(s.backgroundColor).toBe("#F5F2EC");
  });

  it("honors a custom size", () => {
    const { toJSON } = render(wrap(<IconBadge icon="home" size={40} />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.width).toBe(40);
    expect(s.height).toBe(40);
  });

  it("renders an icon child", () => {
    const { toJSON } = render(wrap(<IconBadge icon="heart" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    expect(root && (root as { children?: unknown[] }).children?.length).toBeGreaterThan(0);
  });
});
