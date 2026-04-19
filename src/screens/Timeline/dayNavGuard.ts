import { useSheetStore } from "@/state/sheetStore";

// Debounce window for repeated history-paywall attempts. After the user
// cancels a paywall (or the paywall closes for any reason), we suppress
// the next re-open for this long so rapid tap-tap-tap on the disabled
// chevron doesn't spam the sheet.
const RATE_LIMIT_MS = 2_500;
let lastOpenedAt = 0;

/**
 * Paywall trigger used when a free user attempts to navigate past the
 * 14-day history limit in the Timeline day-navigator. Split into its own
 * module so `DayNavHeader` can call it from a render-time callback without
 * pulling the entire `useSheetStore` hook API into the component.
 *
 * Rate-limited to one open per RATE_LIMIT_MS — repeated taps within the
 * window no-op silently.
 */
export function openSheet(): void {
  const now = Date.now();
  if (now - lastOpenedAt < RATE_LIMIT_MS) return;
  lastOpenedAt = now;
  useSheetStore.getState().openSheet("paywall", { source: "history" });
}

/** Test hook — reset the rate-limit clock. */
export function _resetRateLimit(): void {
  lastOpenedAt = 0;
}
