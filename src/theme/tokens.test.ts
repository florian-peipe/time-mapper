import { tokens } from "./tokens";

describe("design tokens", () => {
  it("defines both light and dark themes", () => {
    expect(tokens.light).toBeDefined();
    expect(tokens.dark).toBeDefined();
  });

  it("both themes declare the same token keys", () => {
    const lightKeys = Object.keys(tokens.light).sort();
    const darkKeys = Object.keys(tokens.dark).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it("every color token is a valid 6-digit hex", () => {
    const hex = /^#[0-9A-Fa-f]{6}$/;
    for (const theme of [tokens.light, tokens.dark]) {
      for (const [key, value] of Object.entries(theme)) {
        if (key.startsWith("color.")) {
          expect(value).toMatch(hex);
        }
      }
    }
  });

  it("type scale is monotonic descending", () => {
    const sizes = [
      tokens.type.size.display,
      tokens.type.size.xl,
      tokens.type.size.l,
      tokens.type.size.m,
      tokens.type.size.body,
      tokens.type.size.s,
      tokens.type.size.xs,
    ];
    const sorted = [...sizes].sort((a, b) => b - a);
    expect(sizes).toEqual(sorted);
  });

  it("exposes the 8-color place palette", () => {
    const { PLACE_COLORS } = require("./tokens");
    expect(PLACE_COLORS).toHaveLength(8);
    for (const c of PLACE_COLORS) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
