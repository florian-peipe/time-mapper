import { legalRoute } from "../routes";

describe("legalRoute", () => {
  it("passes the string through unchanged at runtime", () => {
    // The cast is purely a TypeScript convenience — the runtime value is
    // still the original string, which is what expo-router expects.
    expect(legalRoute("/legal/privacy")).toBe("/legal/privacy");
    expect(legalRoute("/legal/terms")).toBe("/legal/terms");
    expect(legalRoute("/legal/impressum")).toBe("/legal/impressum");
  });
});
