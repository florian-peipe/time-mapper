/**
 * Shared constants + validators for the NotificationsSheet. Kept out of the
 * sheet/section components so the sections remain purely presentational and
 * the orchestrator can import the window-validity check without pulling in
 * any JSX.
 */

/** Default quiet-hours window when the user first enables the feature. */
export const DEFAULT_QUIET_START_H = 22;
export const DEFAULT_QUIET_END_H = 7;

/** Default hour for the daily digest when none is persisted yet. */
export const DEFAULT_DIGEST_HOUR = 8;

/**
 * A zero-width quiet-hours window (`startH === endH`) would silence
 * notifications for exactly 0 minutes — confusing, so we block Save. Only
 * flagged when the toggle is enabled; a disabled toggle means the values
 * are moot and saving clears the KV entry.
 */
export function isQuietRangeInvalid(enabled: boolean, startH: number, endH: number): boolean {
  return enabled && startH === endH;
}
