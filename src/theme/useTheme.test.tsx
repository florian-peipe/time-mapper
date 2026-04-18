import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./useTheme";

function Probe() {
  const theme = useTheme();
  return <Text testID="probe">{theme.color("color.accent")}</Text>;
}

function MotionProbe() {
  const theme = useTheme();
  return <Text testID="motion-probe">{theme.motion.duration.base}</Text>;
}

describe("useTheme", () => {
  it("returns light accent when scheme is light", () => {
    render(
      <ThemeProvider schemeOverride="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("#FF6A3D");
  });

  it("returns dark accent when scheme is dark", () => {
    render(
      <ThemeProvider schemeOverride="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("#FF7B52");
  });

  it("exposes motion tokens with the default 200ms base duration", () => {
    render(
      <ThemeProvider schemeOverride="light">
        <MotionProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("motion-probe")).toHaveTextContent("200");
  });
});
