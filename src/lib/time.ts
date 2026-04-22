import { format, type Locale } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { i18n } from "./i18n";

const locales: Record<string, Locale> = { de, en: enUS };

export const DAY_S = 86_400;
export const DAY_MS = 86_400_000;

/** Current unix-second timestamp. The canonical "now in seconds" source. */
export function nowS(): number {
  return Math.floor(Date.now() / 1000);
}

export function formatDate(unix: number, pattern: string, locale = "en"): string {
  return format(new Date(unix * 1000), pattern, { locale: locales[locale] ?? enUS });
}

/** Zero-pad `n` to `width` digits. Shared HH/MM/SS formatter helper. */
export function padNumber(n: number, width = 2): string {
  return n.toString().padStart(width, "0");
}

/**
 * Compact duration — `"1h 23m"` / `"23m"` — for notification bodies,
 * bar-chart totals, and edit-preview chips. Omits the hours slot when
 * zero; use {@link formatDurationFixed} when a fixed width is needed.
 */
export function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${padNumber(m)}m`;
}

/**
 * Fixed-width duration — always `"Xh YYm"` including `"0h 00m"`. Used by
 * the Timeline EntryRow's trailing duration cell so alignment stays
 * stable when scrolling a list of entries.
 */
export function formatDurationFixed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
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
 * timers (e.g. RunningTimerCard).
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
