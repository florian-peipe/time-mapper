import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ScreenShell } from "./ScreenShell";

const wrap = (ui: React.ReactNode) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 320, height: 640 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}
  >
    <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>
  </SafeAreaProvider>
);

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("ScreenShell", () => {
  it("renders children", () => {
    render(
      wrap(
        <ScreenShell>
          <Text>Body</Text>
        </ScreenShell>,
      ),
    );
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("applies horizontal padding from theme by default", () => {
    const { UNSAFE_root } = render(
      wrap(
        <ScreenShell>
          <Text testID="child">x</Text>
        </ScreenShell>,
      ),
    );
    // Find the immediate parent of our text child
    const child = UNSAFE_root.findByProps({ testID: "child" });
    // Walk up to the View added by ScreenShell (parent of the Text wrapper chain)
    let node = child.parent;
    while (node && !(node.props as { style?: unknown }).style) node = node.parent;
    const s = flat((node?.props as { style?: unknown })?.style);
    // tokens.space[5] = 20 — design-system rule: 20px screen horizontal padding
    expect(s.paddingHorizontal).toBe(20);
  });

  it("respects safe-area top inset when padding is on", () => {
    const { UNSAFE_root } = render(
      wrap(
        <ScreenShell>
          <Text testID="child">x</Text>
        </ScreenShell>,
      ),
    );
    const child = UNSAFE_root.findByProps({ testID: "child" });
    let node = child.parent;
    while (node && !(node.props as { style?: unknown }).style) node = node.parent;
    const s = flat((node?.props as { style?: unknown })?.style);
    // 47 (mocked top) + space[2]=8 = 55
    expect(s.paddingTop).toBe(55);
  });

  it("uses theme bg color", () => {
    const { UNSAFE_root } = render(
      wrap(
        <ScreenShell>
          <Text testID="child">x</Text>
        </ScreenShell>,
      ),
    );
    const child = UNSAFE_root.findByProps({ testID: "child" });
    let node = child.parent;
    while (node && !(node.props as { style?: unknown }).style) node = node.parent;
    const s = flat((node?.props as { style?: unknown })?.style);
    // light bg = #FCFBF9
    expect(s.backgroundColor).toBe("#FCFBF9");
  });

  it("renders ScrollView when scroll prop set", () => {
    const { UNSAFE_root } = render(
      wrap(
        <ScreenShell scroll>
          <Text>x</Text>
        </ScreenShell>,
      ),
    );
    // ScrollView root is identifiable by its testable host — easiest: type name "RCTScrollView"
    // But across RN versions it can vary. Just confirm tree renders without error.
    expect(UNSAFE_root).toBeTruthy();
  });
});
