import React from "react";
import { render, act } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { TrackingDot } from "./TrackingDot";

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

describe("TrackingDot", () => {
  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders a dot at default size 8 with success color", async () => {
    const result = render(wrap(<TrackingDot />));
    // Flush the async isReduceMotionEnabled state update
    await act(async () => {});
    const tree = result.toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.width).toBe(8);
    expect(s.height).toBe(8);
    // success token light = #2E9A5E
    expect(s.backgroundColor).toBe("#2E9A5E");
  });

  it("uses custom size", async () => {
    const result = render(wrap(<TrackingDot size={12} />));
    await act(async () => {});
    const tree = result.toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.width).toBe(12);
    expect(s.height).toBe(12);
  });

  it("renders a static dot when reduce-motion is enabled", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
    const result = render(wrap(<TrackingDot />));
    await act(async () => {});
    const tree = result.toJSON();
    expect(tree).not.toBeNull();
  });
});
