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
  return `${h} h ${padNumber(m)} min`;
}

/** Zero-pad `n` to `width` digits. Shared HH/MM/SS formatter helper. */
export function padNumber(n: number, width = 2): string {
  return n.toString().padStart(width, "0");
}

/**
 * Compact variant of `formatDuration` — `"1h 23m"` / `"23m"` — for
 * notification bodies, bar-chart totals, and edit-preview chips. Use
 * `formatDuration` when you want the spaced "1 h 23 min" human form.
 */
export function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${padNumber(m)}m`;
}

/**
 * Format a unix-second timestamp as local `HH:MM`. Used by row renderers
 * (Timeline, Stats, EntryEdit) that want a compact wall-clock label.
 */
export function formatClock(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${padNumber(d.getHours())}:${padNumber(d.getMinutes())}`;
}

/**
 * Format a duration in **seconds** as `HH:MM:SS`. For clock-style elapsed
 * timers (e.g. RunningTimerCard). Use `formatDuration` instead when you
 * want the human-readable "1 h 23 min" variant.
 */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${padNumber(h)}:${padNumber(m)}:${padNumber(sec)}`;
}

/**
 * Pick the best BCP-47 locale for `Date#toLocale*` calls based on the active
 * i18n locale. We only ship `en-US` and `de-DE` — anything unrecognized
 * falls back to `en-US` so string formatting stays stable.
 */
export function localeForDateApis(): string {
  return i18n.locale.startsWith("de") ? "de-DE" : "en-US";
}
