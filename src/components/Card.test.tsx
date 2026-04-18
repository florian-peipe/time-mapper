import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Card } from "./Card";

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

describe("Card", () => {
  it("renders children", () => {
    render(
      wrap(
        <Card variant="tile">
          <Text>Hello</Text>
        </Card>,
      ),
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("tile variant has 1px border and md radius, no shadow", () => {
    const { toJSON } = render(
      wrap(
        <Card variant="tile">
          <Text>x</Text>
        </Card>,
      ),
    );
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.borderWidth).toBe(1);
    expect(s.borderRadius).toBe(12); // tokens.radius.md
    expect(s.shadowOpacity ?? 0).toBe(0);
  });

  it("hero variant has md radius, shadow, no border", () => {
    const { toJSON } = render(
      wrap(
        <Card variant="hero">
          <Text>x</Text>
        </Card>,
      ),
    );
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.borderWidth ?? 0).toBe(0);
    expect(s.borderRadius).toBe(12);
    expect(s.shadowOpacity).toBeGreaterThan(0);
  });

  it("elevated variant has lg radius, shadow, no border", () => {
    const { toJSON } = render(
      wrap(
        <Card variant="elevated">
          <Text>x</Text>
        </Card>,
      ),
    );
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.borderRadius).toBe(20); // tokens.radius.lg
    expect(s.borderWidth ?? 0).toBe(0);
  });

  it("becomes pressable when onPress is provided", () => {
    const onPress = jest.fn();
    render(
      wrap(
        <Card variant="tile" onPress={onPress}>
          <Text>Tap</Text>
        </Card>,
      ),
    );
    fireEvent.press(screen.getByText("Tap"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
