import { create } from "zustand";

/**
 * Monotonic counters bumped whenever places or entries are mutated. Every
 * consumer hook (`usePlaces`, `useEntries`, `useOngoingEntry`,
 * `useWeekStats`) subscribes to the relevant counter and re-queries the
 * underlying repo when it changes — so a mutation on one screen propagates
 * to every other screen without a remount.
 *
 * Also bumped from the foreground-reconcile path so entries written by the
 * background geofence task land on the UI the next time the user opens
 * the app.
 */
export type DataVersionStore = {
  placesVersion: number;
  entriesVersion: number;
  bumpPlaces: () => void;
  bumpEntries: () => void;
  bumpAll: () => void;
};

export const useDataVersionStore = create<DataVersionStore>((set) => ({
  placesVersion: 0,
  entriesVersion: 0,
  bumpPlaces: () => set((s) => ({ placesVersion: s.placesVersion + 1 })),
  bumpEntries: () => set((s) => ({ entriesVersion: s.entriesVersion + 1 })),
  bumpAll: () =>
    set((s) => ({
      placesVersion: s.placesVersion + 1,
      entriesVersion: s.entriesVersion + 1,
    })),
}));
