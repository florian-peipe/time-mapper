// Sibling to documents.test.ts. That file mocks `./contact.local` to `null` at
// file scope to cover the unconfigured-fallback path; here we mock it *filled*
// so the interpolation branch is exercised. Jest module mocks hoist per-file,
// which is why this needs to live in its own file.
import { getLegalDocument, UNCONFIGURED_IMPRESSUM, type Locale } from "./documents";

jest.mock(
  "./contact.local",
  () => ({
    __esModule: true,
    default: {
      ownerName: "Test Owner",
      address: "Teststraße 1, 50667 Köln",
      email: "contact@example.com",
      phone: "+49 221 0000000",
    },
  }),
  { virtual: true },
);

const FILLED = {
  ownerName: "Test Owner",
  address: "Teststraße 1, 50667 Köln",
  email: "contact@example.com",
  phone: "+49 221 0000000",
};

describe("documents.getLegalDocument — filled Impressum", () => {
  for (const locale of ["en", "de"] as const) {
    it(`returns interpolated Impressum (not the unconfigured variant) for ${locale}`, () => {
      const doc = getLegalDocument("impressum", locale);
      expect(doc).not.toEqual(UNCONFIGURED_IMPRESSUM[locale]);
      // Title stays from the live template, not the "not yet configured" one.
      expect(doc.title).toBe("Impressum");
      expect(doc.blocks.some((b) => b.text.includes("noch nicht konfiguriert"))).toBe(false);
      expect(doc.blocks.some((b) => b.text.includes("not yet configured"))).toBe(false);
    });

    it(`substitutes all four contact fields into the rendered blocks (${locale})`, () => {
      const doc = getLegalDocument("impressum", locale);
      const joined = doc.blocks.map((b) => b.text).join("\n");
      expect(joined).toContain(FILLED.ownerName);
      expect(joined).toContain(FILLED.address);
      expect(joined).toContain(FILLED.email);
      expect(joined).toContain(FILLED.phone);
    });

    it(`leaves no {{TOKEN}} placeholders after interpolation (${locale})`, () => {
      const doc = getLegalDocument("impressum", locale);
      for (const block of doc.blocks) {
        expect(block.text).not.toMatch(/\{\{[A-Z_]+\}\}/);
      }
    });
  }

  it("renders ownerName in both the Owner block AND the 'Responsible for content' line", () => {
    // {{OWNER_NAME}} appears twice in the template — once under the Owner
    // heading and again under "Responsible for content". A buggy interpolator
    // that only replaces the first match would leave a placeholder behind.
    for (const locale of ["en", "de"] as Locale[]) {
      const doc = getLegalDocument("impressum", locale);
      const occurrences = doc.blocks.filter((b) => b.text.includes(FILLED.ownerName)).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);
    }
  });
});
