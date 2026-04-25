import { create } from "zustand";

export type SheetName = "entryEdit" | "addPlace" | "paywall";

/**
 * `addPlace` accepts an optional `source` discriminator so the onboarding flow
 * can mark the "first place" save path and trigger different post-save
 * behavior (mark onboarding complete, nav to tabs). Other sources get the
 * default no-op save.
 */
export type AddPlaceSource = "onboarding" | "places-tab";

/** Where the paywall was opened from — logged to Sentry breadcrumbs. */
export type PaywallSource =
  | "2nd-place"
  | "export"
  | "history"
  | "settings"
  | "settings-upgrade"
  | "settings-downgrade";

/** Whether the sheet is a fresh subscription or a plan switch. */
export type PaywallMode = "subscribe" | "change";

export type SheetPayload =
  | { entryId: string | null }
  | { placeId: string | null; source?: AddPlaceSource }
  | {
      paywallSource: PaywallSource;
      /** Defaults to "subscribe". "change" hides the non-target package card. */
      mode?: PaywallMode;
      /** The user's current store product id — passed as Android googleProductChangeInfo. */
      currentProductId?: string;
    };

/**
 * Form state stashed when the paywall interrupts an AddPlaceSheet flow. We
 * persist the minimum needed to rehydrate the sheet at Phase 2: the resolved
 * place description + coordinates, the currently-picked name/color/icon/
 * radius/buffers, plus the source tag so post-save behavior is preserved.
 *
 * Populated by `AddPlaceSheet` before it opens the paywall. Consumed by
 * `openPaywall` on a successful purchase to re-open the sheet with the same
 * form data. Cleared by `AddPlaceSheet` on mount after rehydration.
 */
export type PendingPlaceForm = {
  placeId: string | null;
  source?: AddPlaceSource;
  description: string;
  latitude: number;
  longitude: number;
  name: string;
  radiusM: number;
  colorIdx: number;
  iconIdx: number;
  entryBufferMin: number;
  exitBufferMin: number;
  /** null / omitted = goal not enabled */
  dailyGoalMinutes: number | null;
  weeklyGoalMinutes: number | null;
  /** Comma-separated ISO day numbers; null = every day. */
  dailyGoalDays?: string | null;
};

type SheetState = {
  active: SheetName | null;
  payload: SheetPayload | null;
  /**
   * When an AddPlace flow opens the paywall, it stores its form here. After
   * a successful purchase, `openPaywall` re-opens `addPlace` with the saved
   * `placeId` + `source`; `AddPlaceSheet` hydrates from this slot and clears
   * it. Left untouched on cancel so the user's work isn't lost.
   */
  pendingPlaceForm: PendingPlaceForm | null;
  openSheet: (name: SheetName, payload?: SheetPayload | null) => void;
  closeSheet: () => void;
  setPendingPlaceForm: (form: PendingPlaceForm | null) => void;
};

export const useSheetStore = create<SheetState>((set) => ({
  active: null,
  payload: null,
  pendingPlaceForm: null,
  openSheet: (name, payload = null) => set({ active: name, payload }),
  closeSheet: () => set({ active: null, payload: null }),
  setPendingPlaceForm: (form) => set({ pendingPlaceForm: form }),
}));
