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
export type AddPlaceSource = "onboarding" | "places-list" | "settings-places";

export type SheetPayload =
  | { source: "2nd-place" | "export" | "history" | "settings" }
  | { entryId: string | null }
  | { placeId: string | null; source?: AddPlaceSource };

type SheetState = {
  active: SheetName | null;
  payload: SheetPayload | null;
  openSheet: (name: SheetName, payload?: SheetPayload | null) => void;
  closeSheet: () => void;
};

export const useSheetStore = create<SheetState>((set) => ({
  active: null,
  payload: null,
  openSheet: (name, payload = null) => set({ active: name, payload: payload ?? null }),
  closeSheet: () => set({ active: null, payload: null }),
}));
