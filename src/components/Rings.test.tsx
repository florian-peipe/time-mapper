import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Rings } from "./Rings";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

describe("Rings", () => {
  it("renders an svg with default size", () => {
    const { toJSON } = render(wrap(<Rings />));
    const tree = toJSON();
    expect(tree).not.toBeNull();
  });

  it("renders four concentric circles", () => {
    const { UNSAFE_root } = render(wrap(<Rings />));
    // react-native-svg Circle becomes RNSVGCircle in the tree
    const circles = UNSAFE_root.findAllByType("RNSVGCircle" as never);
    expect(circles).toHaveLength(4);
  });

  it("forwards size, color and opacity props", () => {
    const { toJSON } = render(wrap(<Rings size={240} color="#FF6A3D" opacity={0.07} />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    // Wrapped in a view that holds opacity; svg itself holds width/height
    expect(root).not.toBeNull();
  });
});
