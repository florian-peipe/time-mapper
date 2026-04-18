import { format, type Locale } from "date-fns";
import { de, enUS } from "date-fns/locale";

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
