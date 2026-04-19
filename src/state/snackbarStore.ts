import { create } from "zustand";

/**
 * Lightweight global snackbar store. Any caller can request a transient
 * bottom-of-screen notification by pushing a `Snack` descriptor, optionally
 * with an "Undo" action. The UI layer (`SnackbarHost`) subscribes, renders
 * the current snack, and ticks it off the queue after its TTL.
 *
 * Why a store and not prop-drilling?
 *   The undo-on-delete flow fires from deep inside EntryEditSheet, Settings,
 *   or Timeline — passing a callback down the tree would be noisy. A tiny
 *   zustand slice keeps the surface area minimal (show + dismiss + peek).
 *
 * Design notes:
 *   - Only one snack visible at a time. Showing a second snack replaces the
 *     first immediately — matches Material snackbar guidance and keeps the
 *     timer logic trivial.
 *   - TTL defaults to 5s (the undo-window the spec asks for). Callers can
 *     override for longer-dwell messages if needed.
 *   - The store is side-effect free; the `SnackbarHost` owns the dismissal
 *     timer so hot-reloads don't leave orphan intervals in the JS engine.
 */

export type SnackAction = {
  /** Localized label shown on the right-hand action button. */
  label: string;
  /** Fired when the user taps the action. The snack dismisses itself after. */
  onPress: () => void;
};

export type Snack = {
  id: string;
  /** Primary localized message. Kept short (ideally one line). */
  message: string;
  /** Optional action button (e.g. "Undo"). */
  action?: SnackAction;
  /** Time-to-live in milliseconds. Default 5000. */
  ttlMs: number;
};

type SnackbarState = {
  current: Snack | null;
  /**
   * Monotonic counter used to generate unique snack ids. Independent from
   * `uuid()` because we want deterministic test assertions and don't need
   * cross-device uniqueness — snacks live milliseconds in memory only.
   */
  seq: number;
  show: (input: { message: string; action?: SnackAction; ttlMs?: number }) => string;
  dismiss: (id?: string) => void;
};

export const DEFAULT_SNACK_TTL_MS = 5000;

export const useSnackbarStore = create<SnackbarState>((set, get) => ({
  current: null,
  seq: 0,
  show: ({ message, action, ttlMs = DEFAULT_SNACK_TTL_MS }) => {
    const seq = get().seq + 1;
    const id = `snack-${seq}`;
    set({ current: { id, message, action, ttlMs }, seq });
    return id;
  },
  dismiss: (id) => {
    const cur = get().current;
    if (!cur) return;
    // If a specific id was given, only dismiss when it matches. This prevents
    // a late timer from clobbering a newer snack — each timer fires with the
    // snack id it was scheduled for.
    if (id != null && cur.id !== id) return;
    set({ current: null });
  },
}));
