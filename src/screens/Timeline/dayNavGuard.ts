import { useSheetStore } from "@/state/sheetStore";

/**
 * Paywall trigger used when a free user attempts to navigate past the
 * 14-day history limit in the Timeline day-navigator. Split into its own
 * module so `DayNavHeader` can call it from a render-time callback without
 * pulling the entire `useSheetStore` hook API into the component.
 */
export function openSheet(): void {
  useSheetStore.getState().openSheet("paywall", { source: "history" });
}
