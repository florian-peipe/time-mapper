import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

describe("Icon", () => {
  it("renders a known place icon (home)", () => {
    const { UNSAFE_root } = render(wrap(<Icon name="home" />));
    // Lucide renders an RNSVGSvgView at the root; presence of children proves render
    expect(UNSAFE_root).toBeTruthy();
  });

  it("renders a known system icon (chevron-left)", () => {
    const { toJSON } = render(wrap(<Icon name="chevron-left" />));
    const tree = toJSON();
    expect(tree).not.toBeNull();
  });

  it("forwards size and color to the underlying svg", () => {
    const { toJSON } = render(
      wrap(<Icon name="bar-chart" size={32} color="#123456" strokeWidth={2} />),
    );
    const tree = toJSON();
    // Lucide passes through to react-native-svg Svg, which sets width/height/stroke
    // on its root host. tree may be a single object with these props.
    const root = Array.isArray(tree) ? tree[0] : tree;
    expect(root).not.toBeNull();
    // Width and height come from `size` prop
    expect(root && (root as { props: Record<string, unknown> }).props.width).toBe(32);
    expect(root && (root as { props: Record<string, unknown> }).props.height).toBe(32);
    // Stroke color comes from `color` prop
    expect(root && (root as { props: Record<string, unknown> }).props.stroke).toBe("#123456");
  });

  it("uses theme fg as default color when no color prop given", () => {
    const { toJSON } = render(wrap(<Icon name="home" />));
    const tree = toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    // light theme color.fg is #1A1714
    expect(root && (root as { props: Record<string, unknown> }).props.stroke).toBe("#1A1714");
  });
});
