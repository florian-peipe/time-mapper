import { useEffect, useRef } from "react";
import { useSheetStore, type SheetName } from "@/state/sheetStore";

/**
 * Calls `refresh()` whenever the active sheet transitions *from one of*
 * `watch` *to* `null` — i.e. a watched sheet just closed.
 *
 * Why this exists: the feature hooks (`useEntries`, `useOngoingEntry`,
 * `useWeekStats`) expose manual `refresh()` so callers decide when to reload.
 * Most screens care about one specific moment: when the user finishes editing
 * something in a sheet and comes back to the list view. Centralising that
 * pattern here avoids every screen reimplementing a `prevActive` ref with the
 * same subtle bugs (firing on mount, firing on sheet-to-sheet navigation, etc).
 *
 * Edge cases intentionally handled:
 * - Mounting with an open sheet does not fire — we only care about the
 *   close transition.
 * - Sheet-to-sheet navigation (e.g. entryEdit → paywall) does not fire —
 *   the user hasn't returned to the screen yet.
 * - Unrelated sheet closures do not fire.
 * - A single string is accepted as shorthand for one-element list.
 */
export function useRefreshOnSheetClose(
  watch: SheetName | readonly SheetName[],
  refresh: () => void,
): void {
  const active = useSheetStore((s) => s.active);
  const prevActive = useRef<SheetName | null>(active);
  const refreshRef = useRef(refresh);
  // Keep the latest refresh fn reachable from the effect without forcing
  // consumers to memoize it — this is the same trick React's own
  // `useEvent` RFC uses for event callbacks.
  refreshRef.current = refresh;

  useEffect(() => {
    const watched = Array.isArray(watch) ? watch : [watch];
    const prev = prevActive.current;
    const justClosed = prev !== null && active === null && watched.includes(prev);
    if (justClosed) refreshRef.current();
    prevActive.current = active;
    // `watch` is an array literal at typical call sites; we depend on `active`
    // only because `watch` identity is owned by the caller. If a caller passes
    // an unstable array we'd re-run harmlessly (prevActive equality guards us
    // from double-firing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
