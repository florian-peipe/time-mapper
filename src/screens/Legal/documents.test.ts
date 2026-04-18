import { getLegalDocument, UNCONFIGURED_IMPRESSUM, LEGAL_DOCS } from "./documents";

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
    // The sandbox has no contact.local.ts — the loader should gracefully
    // fall back instead of leaking literal {{...}} tokens into the UI.
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
