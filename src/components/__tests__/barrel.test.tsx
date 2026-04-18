import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import * as Components from "@/components";

const wrap = (ui: React.ReactNode) =>
  render(<ThemeProvider schemeOverride="light">{ui}</ThemeProvider>);

describe("component barrel exports", () => {
  it("exports expected primitives", () => {
    const names = Object.keys(Components).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        "Banner",
        "Button",
        "Card",
        "Chip",
        "Icon",
        "IconBadge",
        "Input",
        "ListRow",
        "PlaceBubble",
        "Rings",
        "ScreenShell",
        "Section",
        "SegmentedControl",
        "Sheet",
        "SourceChip",
        "TextArea",
        "TrackingDot",
      ]),
    );
  });

  // Minimal render smoke for each non-interactive primitive that doesn't require specialized props
  it("renders PlaceBubble, SourceChip, TrackingDot, Rings without throwing", () => {
    expect(() => wrap(<Components.PlaceBubble icon="home" color="#FF6A3D" />)).not.toThrow();
    expect(() => wrap(<Components.SourceChip kind="auto" />)).not.toThrow();
    expect(() => wrap(<Components.TrackingDot />)).not.toThrow();
    expect(() => wrap(<Components.Rings />)).not.toThrow();
  });

  it("renders Button + Card + Input without throwing", () => {
    expect(() =>
      wrap(<Components.Button onPress={() => {}}>Tap</Components.Button>),
    ).not.toThrow();
    expect(() =>
      wrap(
        <Components.Card variant="tile">
          <></>
        </Components.Card>,
      ),
    ).not.toThrow();
    expect(() => wrap(<Components.Input value="" onChangeText={() => {}} />)).not.toThrow();
  });
});
