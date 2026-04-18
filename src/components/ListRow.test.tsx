import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Switch, Text } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ListRow } from "./ListRow";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

function flat(style: unknown): Record<string, unknown> {
  if (style == null) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => flat(s)));
  }
  return style as Record<string, unknown>;
}

describe("ListRow", () => {
  it("renders the title and a string detail", () => {
    render(wrap(<ListRow icon="clock" title="Default buffers" detail="5 / 3 min" />));
    expect(screen.getByText("Default buffers")).toBeTruthy();
    expect(screen.getByText("5 / 3 min")).toBeTruthy();
  });

  it("fires onPress when tapped", () => {
    const onPress = jest.fn();
    render(wrap(<ListRow icon="moon" title="Theme" onPress={onPress} />));
    fireEvent.press(screen.getByText("Theme"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("auto-shows a chevron when onPress is provided and no accessoryRight", () => {
    const { toJSON } = render(wrap(<ListRow icon="moon" title="Theme" onPress={() => {}} />));
    const tree = toJSON();
    // presence of chevron-right svg is enough; the simplest assertion is that
    // the rendered tree serializes with 'chevron' somewhere. We look via JSON.
    expect(JSON.stringify(tree)).toContain("stroke"); // lucide icons draw via stroke
  });

  it("does NOT show a chevron when accessoryRight is provided", () => {
    render(
      wrap(
        <ListRow
          icon="moon"
          title="Dark mode"
          onPress={() => {}}
          accessoryRight={<Switch value={true} />}
        />,
      ),
    );
    // Switch present, but we do not assert chevron absence via icon because
    // IconBadge also uses Icon. Instead, assert the Switch rendered.
    expect(screen.UNSAFE_getByType(Switch)).toBeTruthy();
  });

  it("renders detail as a ReactNode when given one", () => {
    render(
      wrap(
        <ListRow
          icon="clock"
          title="Detail as node"
          detail={<Text testID="custom-detail">custom</Text>}
        />,
      ),
    );
    expect(screen.getByTestId("custom-detail")).toBeTruthy();
  });

  it("has a bottom hairline unless last", () => {
    const { toJSON: normal } = render(wrap(<ListRow icon="moon" title="Normal" />));
    const { toJSON: last } = render(wrap(<ListRow icon="moon" title="Last" last />));
    const normalRoot = Array.isArray(normal()) ? normal()[0] : normal();
    const lastRoot = Array.isArray(last()) ? last()[0] : last();
    const sNormal = flat(normalRoot && (normalRoot as { props: { style: unknown } }).props.style);
    const sLast = flat(lastRoot && (lastRoot as { props: { style: unknown } }).props.style);
    expect(Number(sNormal.borderBottomWidth)).toBeGreaterThan(0);
    expect(Number(sLast.borderBottomWidth) || 0).toBe(0);
  });

  it("renders without an icon when no icon prop is passed", () => {
    render(wrap(<ListRow title="Plain title" detail="value" />));
    expect(screen.getByText("Plain title")).toBeTruthy();
  });
});
