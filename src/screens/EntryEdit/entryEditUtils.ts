/** Default start — 09:00 local on the anchor date. */
export function defaultStart(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Default end — 10:00 local on the anchor date. */
export function defaultEnd(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(10, 0, 0, 0);
  return d;
}

/**
 * Encode a pause duration (in minutes) as a `Date` whose hours +
 * minutes carry the value. Used as the `value` of the pause picker so
 * the native time wheel can edit it. Seconds/date portions are fixed
 * so the chip always reads "HH:MM".
 */
export function pauseMinutesToDate(minutes: number): Date {
  const d = new Date(0);
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  d.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
  return d;
}

export function pauseDateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
