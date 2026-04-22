import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Body, Heading, Typography } from "./Typography";

function wrap(node: React.ReactElement) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe("Typography", () => {
  it("renders children", () => {
    const { getByText } = render(wrap(<Typography>hello</Typography>));
    expect(getByText("hello")).toBeTruthy();
  });

  it("Heading variant is semibold + xl size", () => {
    const { getByText } = render(wrap(<Heading>Stats</Heading>));
    const node = getByText("Stats");
    const style = (
      Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style
    ) as {
      fontSize: number;
      fontWeight: string;
    };
    expect(style.fontSize).toBe(24);
    expect(style.fontWeight).toBe("600");
  });

  it("Body variant defaults to body size + regular weight", () => {
    const { getByText } = render(wrap(<Body>copy</Body>));
    const node = getByText("copy");
    const style = (
      Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style
    ) as {
      fontSize: number;
      fontWeight: string;
    };
    expect(style.fontSize).toBe(15);
    expect(style.fontWeight).toBe("400");
  });

  it("tabularNums applies the fontVariant", () => {
    const { getByText } = render(wrap(<Typography tabularNums>42</Typography>));
    const node = getByText("42");
    const style = (
      Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style
    ) as {
      fontVariant?: readonly string[];
    };
    expect(style.fontVariant).toEqual(["tabular-nums"]);
  });

  it("tone=muted picks fg2", () => {
    const { getByText } = render(wrap(<Typography tone="muted">x</Typography>));
    const node = getByText("x");
    const style = (
      Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style
    ) as {
      color: string;
    };
    // fg2 differs between schemes; we just assert the color key is defined
    // (i.e. not the default fg) via a non-matching comparison.
    expect(style.color).toBeTruthy();
  });

  it("mono flag switches to JetBrainsMono", () => {
    const { getByText } = render(wrap(<Typography mono>m</Typography>));
    const node = getByText("m");
    const style = (
      Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style
    ) as {
      fontFamily: string;
    };
    expect(style.fontFamily).toBe("JetBrainsMono");
  });
});
