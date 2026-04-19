import { format, type Locale } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { i18n } from "./i18n";

const locales: Record<string, Locale> = { de, en: enUS };

export function formatDate(unix: number, pattern: string, locale = "en"): string {
  return format(new Date(unix * 1000), pattern, { locale: locales[locale] ?? enUS });
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")} min`;
}

/**
 * Pick the best BCP-47 locale for `Date#toLocale*` calls based on the active
 * i18n locale. We only ship `en-US` and `de-DE` — anything unrecognized
 * falls back to `en-US` so string formatting stays stable.
 */
export function localeForDateApis(): string {
  return i18n.locale.startsWith("de") ? "de-DE" : "en-US";
}
