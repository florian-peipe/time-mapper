import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { StepIndicator } from "./StepIndicator";

function wrap(current: number, total: number) {
  return render(
    <ThemeProvider schemeOverride="light">
      <StepIndicator current={current} total={total} testID="steps" />
    </ThemeProvider>,
  );
}

describe("StepIndicator", () => {
  it("renders one dot per step", () => {
    const { getByTestId } = wrap(1, 3);
    expect(getByTestId("steps-dot-1")).toBeTruthy();
    expect(getByTestId("steps-dot-2")).toBeTruthy();
    expect(getByTestId("steps-dot-3")).toBeTruthy();
  });

  it("the current dot is wider (active pill) than the others", () => {
    const { getByTestId } = wrap(2, 3);
    const styleOf = (node: { props: { style: { width?: number } | { width?: number }[] } }) => {
      const s = node.props.style;
      const flat = Array.isArray(s) ? Object.assign({}, ...s) : s;
      return flat.width;
    };
    const dot1 = styleOf(getByTestId("steps-dot-1"));
    const dot2 = styleOf(getByTestId("steps-dot-2"));
    const dot3 = styleOf(getByTestId("steps-dot-3"));
    expect(dot2).toBeGreaterThan(dot1);
    expect(dot2).toBeGreaterThan(dot3);
  });

  it("is not announced as an accessibility group", () => {
    const { getByTestId } = wrap(1, 3);
    expect(getByTestId("steps").props.accessible).toBe(false);
  });

  it("supports an arbitrary number of steps", () => {
    const { getByTestId } = wrap(4, 5);
    expect(getByTestId("steps-dot-1")).toBeTruthy();
    expect(getByTestId("steps-dot-5")).toBeTruthy();
    // The 4th dot should be the active one — pill-sized.
    const dot4 = getByTestId("steps-dot-4").props.style as { width: number };
    expect(dot4.width).toBeGreaterThan(10);
  });
});
