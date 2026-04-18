import { createI18n } from "./i18n";

describe("i18n", () => {
  it("returns German string when locale is de", () => {
    const i = createI18n("de");
    expect(i.t("tabs.timeline")).toBe("Verlauf");
  });

  it("falls back to English when locale is unknown", () => {
    const i = createI18n("fr-FR");
    expect(i.t("tabs.timeline")).toBe("Timeline");
  });

  it("returns the key itself when missing in all locales", () => {
    const i = createI18n("en");
    expect(i.t("does.not.exist")).toBe("does.not.exist");
  });

  it("locale can be changed at runtime", () => {
    const i = createI18n("en");
    expect(i.t("tabs.timeline")).toBe("Timeline");
    i.setLocale("de");
    expect(i.t("tabs.timeline")).toBe("Verlauf");
  });
});
