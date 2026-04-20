import { create } from "zustand";

export type SheetName = "paywall" | "entryEdit" | "addPlace";

/**
 * Loosely typed per-sheet payload. Each caller asserts the shape it needs when
 * reading `payload` — we don't attempt to narrow by `SheetName` at the store
 * level to keep the store trivially replaceable.
 *
 * `addPlace` accepts an optional `source` discriminator so callers like the
 * onboarding flow can mark the "first place" save path and get different
 * post-save behavior (mark onboarding complete, nav to tabs). Unknown sources
 * just no-op through the normal save.
 */
export type AddPlaceSource = "onboarding" | "places-list" | "settings-places" | "places-tab";

export type SheetPayload =
  | { source: "2nd-place" | "export" | "history" | "settings" }
  | { entryId: string | null }
  | { placeId: string | null; source?: AddPlaceSource };

/**
 * Form state stashed when the paywall interrupts an AddPlaceSheet flow. We
 * persist the minimum needed to rehydrate the sheet at Phase 2: the resolved
 * place description + coordinates, the currently-picked name/color/icon/
 * radius/buffers, plus the source tag so post-save behavior is preserved.
 *
 * Populated by `AddPlaceSheet` before it opens the paywall. Consumed by the
 * same sheet on the next mount when `useSheetStore.pendingPlaceForm` is
 * non-null. Cleared by `clearPendingPlaceForm()` after restoration.
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
};

type SheetState = {
  active: SheetName | null;
  payload: SheetPayload | null;
  /**
   * When an AddPlace flow opens the paywall, it stores its form here. After
   * a successful purchase, the caller restores from `pendingPlaceForm` and
   * clears the slot. Cleared automatically when the AddPlace sheet is
   * dismissed without a paywall handoff.
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
  openSheet: (name, payload = null) => set({ active: name, payload: payload ?? null }),
  closeSheet: () => set({ active: null, payload: null }),
  setPendingPlaceForm: (form) => set({ pendingPlaceForm: form }),
}));
