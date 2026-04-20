import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Card } from "./Card";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

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
        <Card>
          <Text>Hello</Text>
        </Card>,
      ),
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("has 1px border and md radius", () => {
    const { toJSON } = render(
      wrap(
        <Card>
          <Text>x</Text>
        </Card>,
      ),
    );
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    const s = flat(root && (root as { props: { style: unknown } }).props.style);
    expect(s.borderWidth).toBe(1);
    expect(s.borderRadius).toBe(12); // tokens.radius.md
  });

  it("becomes pressable when onPress is provided", () => {
    const onPress = jest.fn();
    render(
      wrap(
        <Card onPress={onPress}>
          <Text>Tap</Text>
        </Card>,
      ),
    );
    fireEvent.press(screen.getByText("Tap"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
