import { I18n } from "i18n-js";
import en from "@/locales/en.json";
import de from "@/locales/de.json";

export type AppI18n = {
  t: (key: string, options?: Record<string, unknown>) => string;
  setLocale: (locale: string) => void;
  readonly locale: string;
};

export function createI18n(initialLocale: string): AppI18n {
  const lib = new I18n({ en, de });
  lib.defaultLocale = "en";
  lib.enableFallback = true;
  lib.locale = initialLocale;
  // Locale files use flat dotted keys (e.g. "tabs.timeline") rather than
  // nested objects. i18n-js' default key separator is ".", which would split
  // "tabs.timeline" into a path lookup and miss our flat key. Setting the
  // separator to a control character disables nested resolution while still
  // letting i18n-js find our flat keys verbatim.
  (lib as unknown as { defaultSeparator: string }).defaultSeparator = "\u0000";

  // i18n-js default behavior for missing keys is a bracketed string like
  // `[missing "foo" translation]`. For a cleaner dev/test signal we return
  // the key itself when missing (matches the i18n.test.ts expectation).
  const isMissing = (v: string): boolean => v.startsWith("[missing ");

  return {
    t: (key, options) => {
      const v = lib.t(key, options) as string;
      return isMissing(v) ? key : v;
    },
    setLocale: (locale) => {
      lib.locale = locale;
    },
    get locale() {
      return lib.locale;
    },
  };
}

// App-level singleton, re-initialized at boot in `app/_layout.tsx`.
export let i18n: AppI18n = createI18n("en");

export function initI18n(locale: string): void {
  i18n = createI18n(locale);
}
