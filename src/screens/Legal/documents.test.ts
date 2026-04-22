// The real `contact.local.ts` is only present once a developer has filled
// their Impressum — locally, CI runners don't have it. We mock it to null
// here so the test exercises the "unconfigured" path deterministically,
// regardless of whether this clone has the file or not.
import { getLegalDocument, UNCONFIGURED_IMPRESSUM, LEGAL_DOCS } from "./documents";

jest.mock("./contact.local", () => ({ __esModule: true, default: null }), { virtual: true });

describe("documents.getLegalDocument", () => {
  it("returns the Privacy policy verbatim for EN", () => {
    const doc = getLegalDocument("privacy", "en");
    expect(doc.title).toMatch(/privacy/i);
    expect(doc.blocks.some((b) => b.type === "h1")).toBe(true);
  });

  it("returns the Terms verbatim for DE", () => {
    const doc = getLegalDocument("terms", "de");
    expect(doc.title).toMatch(/nutzungsbedingungen/i);
    expect(doc.blocks.length).toBeGreaterThan(0);
  });

  it("returns the unconfigured Impressum when contact.local.ts is missing", () => {
    // With the mock above forcing contact=null, the loader should gracefully
    // fall back to the "unconfigured" variant instead of leaking literal
    // {{...}} tokens into the UI.
    const enDoc = getLegalDocument("impressum", "en");
    const deDoc = getLegalDocument("impressum", "de");
    expect(enDoc).toEqual(UNCONFIGURED_IMPRESSUM.en);
    expect(deDoc).toEqual(UNCONFIGURED_IMPRESSUM.de);
  });

  it("Impressum template still stores raw {{TOKEN}} placeholders", () => {
    // The raw LEGAL_DOCS["impressum"] content drives the interpolation; if
    // someone removes the tokens by accident the interpolator can't work.
    const raw = LEGAL_DOCS.impressum.en.blocks.map((b) => b.text).join(" ");
    expect(raw).toMatch(/\{\{OWNER_NAME\}\}/);
    expect(raw).toMatch(/\{\{EMAIL\}\}/);
  });

  it("unconfigured Impressum has no unresolved placeholders", () => {
    for (const locale of ["en", "de"] as const) {
      for (const block of UNCONFIGURED_IMPRESSUM[locale].blocks) {
        expect(block.text).not.toMatch(/\{\{[A-Z_]+\}\}/);
      }
    }
  });
});
