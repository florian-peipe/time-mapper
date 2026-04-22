/**
 * Form-state hook for the AddPlaceSheet. Owns every piece of mutable state
 * the sheet needs, including:
 *
 *   - Phase-1 search: `query`, `suggestions`, `searching`, `apiError`
 *   - Phase-2 form:   `selected`, `name`, `radius`, `colorIdx`, `iconIdx`,
 *                     buffer sliders, goal toggles + hour sliders + day filter
 *
 * The effect that reconciles state when the sheet opens/edits/restores
 * lives here too, so AddPlaceSheet stays as a thin renderer.
 *
 * Hydration priority (highest first):
 *   1. `pendingPlaceForm` from the sheet store (post-paywall restore).
 *   2. `editingPlace` — the place being edited.
 *   3. Defaults (for the "new place" flow).
 */
import { useEffect, useMemo, useState } from "react";
import { PLACE_COLORS } from "@/theme/tokens";
import type { IconName } from "@/components";
import type { Place } from "@/db/schema";
import type { KvRepo } from "@/db/repository/kv";
import { useSheetStore } from "@/state/sheetStore";
import { readGlobalBuffers } from "@/screens/Settings/BuffersSheet";
import type { PlaceSuggestion } from "@/lib/geocode";

/** 9 icons users can assign to a place. Exposed so the grid renders them. */
export const ICON_CHOICES: readonly IconName[] = [
  "home",
  "briefcase",
  "dumbbell",
  "coffee",
  "book-open",
  "shopping-bag",
  "heart",
  "music",
  "star",
] as const;

export const RADIUS_DEFAULT = 50;

export const DAILY_GOAL_MIN_H = 1;
export const DAILY_GOAL_MAX_H = 16;
export const DAILY_GOAL_DEFAULT_H = 8;
export const WEEKLY_GOAL_MIN_H = 1;
export const WEEKLY_GOAL_MAX_H = 80;
export const WEEKLY_GOAL_DEFAULT_H = 40;

/** Internal selection — either from an autocomplete pick or an edit. */
export type Selection = {
  description: string;
  placeId?: string;
  latitude: number;
  longitude: number;
};

/** Parse `places.dailyGoalDays` into a sorted array of ISO day numbers. */
export function parseGoalDays(raw: string | null | undefined): number[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
}

export type UsePlaceFormOpts = {
  /** The `placeId` prop on the sheet — null for a new place. */
  placeId: string | null;
  /** Sheet visibility — used to reset state on close. */
  visible: boolean;
  /** Source label forwarded to the sheet store for paywall restore. */
  source?: string;
  /** All places (for edit-mode lookup). */
  places: Place[];
  /** Device KV repo — reads the global buffer defaults for new places. */
  kv: KvRepo;
};

export type UsePlaceFormResult = {
  editing: boolean;
  editingPlace: Place | null;

  // Phase-1 search
  query: string;
  setQuery: (v: string) => void;
  suggestions: PlaceSuggestion[];
  setSuggestions: (v: PlaceSuggestion[]) => void;
  searching: boolean;
  setSearching: (v: boolean) => void;
  apiError: string | null;
  setApiError: (v: string | null) => void;

  // Phase-2 form
  selected: Selection | null;
  setSelected: (v: Selection | null) => void;
  name: string;
  setName: (v: string) => void;
  radius: number;
  setRadius: (v: number) => void;
  colorIdx: number;
  setColorIdx: (v: number) => void;
  iconIdx: number;
  setIconIdx: (v: number) => void;
  resolvingPick: boolean;
  setResolvingPick: (v: boolean) => void;

  // Buffers
  entryBufferMin: number;
  setEntryBufferMin: (v: number) => void;
  exitBufferMin: number;
  setExitBufferMin: (v: number) => void;

  // Goals
  dailyGoalEnabled: boolean;
  setDailyGoalEnabled: (v: boolean) => void;
  dailyGoalHours: number;
  setDailyGoalHours: (v: number) => void;
  dailyGoalDays: number[];
  setDailyGoalDays: (v: number[]) => void;
  weeklyGoalEnabled: boolean;
  setWeeklyGoalEnabled: (v: boolean) => void;
  weeklyGoalHours: number;
  setWeeklyGoalHours: (v: number) => void;
};

export function usePlaceForm(opts: UsePlaceFormOpts): UsePlaceFormResult {
  const { placeId, visible, source, places, kv } = opts;
  const pendingPlaceForm = useSheetStore((s) => s.pendingPlaceForm);
  const setPendingPlaceForm = useSheetStore((s) => s.setPendingPlaceForm);

  const editing = placeId != null;
  const editingPlace = useMemo(
    () => (placeId ? (places.find((p) => p.id === placeId) ?? null) : null),
    [places, placeId],
  );

  // Defaults derived from the edited place, if any. Always safe (index 0)
  // when the stored value isn't in the current choice list.
  const initialColorIdx = useMemo(() => {
    if (!editingPlace) return 0;
    const idx = PLACE_COLORS.findIndex((c) => c === editingPlace.color);
    return idx >= 0 ? idx : 0;
  }, [editingPlace]);
  const initialIconIdx = useMemo(() => {
    if (!editingPlace) return 0;
    const idx = ICON_CHOICES.findIndex((i) => i === editingPlace.icon);
    return idx >= 0 ? idx : 0;
  }, [editingPlace]);
  const initialEntryBufferMin = useMemo(() => {
    if (editingPlace) return Math.round((editingPlace.entryBufferS ?? 300) / 60);
    const { entryBufferS } = readGlobalBuffers(kv);
    return Math.round(entryBufferS / 60);
  }, [editingPlace, kv]);
  const initialExitBufferMin = useMemo(() => {
    if (editingPlace) return Math.round((editingPlace.exitBufferS ?? 180) / 60);
    const { exitBufferS } = readGlobalBuffers(kv);
    return Math.round(exitBufferS / 60);
  }, [editingPlace, kv]);

  // Phase-1 state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resolvingPick, setResolvingPick] = useState(false);

  // Phase-2 state
  const [selected, setSelected] = useState<Selection | null>(
    editingPlace
      ? {
          description: editingPlace.address,
          latitude: editingPlace.latitude,
          longitude: editingPlace.longitude,
        }
      : null,
  );
  const [name, setName] = useState(editingPlace?.name ?? "");
  const [radius, setRadius] = useState(editingPlace?.radiusM ?? RADIUS_DEFAULT);
  const [colorIdx, setColorIdx] = useState(initialColorIdx);
  const [iconIdx, setIconIdx] = useState(initialIconIdx);
  const [entryBufferMin, setEntryBufferMin] = useState(initialEntryBufferMin);
  const [exitBufferMin, setExitBufferMin] = useState(initialExitBufferMin);

  const initialDailyGoalMin = editingPlace?.dailyGoalMinutes ?? null;
  const initialWeeklyGoalMin = editingPlace?.weeklyGoalMinutes ?? null;
  const [dailyGoalEnabled, setDailyGoalEnabled] = useState(initialDailyGoalMin != null);
  const [dailyGoalHours, setDailyGoalHours] = useState(
    initialDailyGoalMin != null
      ? Math.max(DAILY_GOAL_MIN_H, Math.round(initialDailyGoalMin / 60))
      : DAILY_GOAL_DEFAULT_H,
  );
  const [dailyGoalDays, setDailyGoalDays] = useState<number[]>(
    parseGoalDays(editingPlace?.dailyGoalDays ?? null),
  );
  const [weeklyGoalEnabled, setWeeklyGoalEnabled] = useState(initialWeeklyGoalMin != null);
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(
    initialWeeklyGoalMin != null
      ? Math.max(WEEKLY_GOAL_MIN_H, Math.round(initialWeeklyGoalMin / 60))
      : WEEKLY_GOAL_DEFAULT_H,
  );

  // Hydration: pendingPlaceForm (post-paywall) > editingPlace > reset-on-close.
  useEffect(() => {
    if (
      visible &&
      pendingPlaceForm &&
      pendingPlaceForm.placeId === placeId &&
      pendingPlaceForm.source === source
    ) {
      setSelected({
        description: pendingPlaceForm.description,
        latitude: pendingPlaceForm.latitude,
        longitude: pendingPlaceForm.longitude,
      });
      setName(pendingPlaceForm.name);
      setRadius(pendingPlaceForm.radiusM);
      setColorIdx(pendingPlaceForm.colorIdx);
      setIconIdx(pendingPlaceForm.iconIdx);
      setEntryBufferMin(pendingPlaceForm.entryBufferMin);
      setExitBufferMin(pendingPlaceForm.exitBufferMin);
      setDailyGoalEnabled(pendingPlaceForm.dailyGoalMinutes != null);
      if (pendingPlaceForm.dailyGoalMinutes != null) {
        setDailyGoalHours(
          Math.max(DAILY_GOAL_MIN_H, Math.round(pendingPlaceForm.dailyGoalMinutes / 60)),
        );
      }
      setDailyGoalDays(parseGoalDays(pendingPlaceForm.dailyGoalDays ?? null));
      setWeeklyGoalEnabled(pendingPlaceForm.weeklyGoalMinutes != null);
      if (pendingPlaceForm.weeklyGoalMinutes != null) {
        setWeeklyGoalHours(
          Math.max(WEEKLY_GOAL_MIN_H, Math.round(pendingPlaceForm.weeklyGoalMinutes / 60)),
        );
      }
      setPendingPlaceForm(null);
      return;
    }
    if (editingPlace) {
      setSelected({
        description: editingPlace.address,
        latitude: editingPlace.latitude,
        longitude: editingPlace.longitude,
      });
      setName(editingPlace.name);
      setRadius(editingPlace.radiusM);
      setColorIdx(initialColorIdx);
      setIconIdx(initialIconIdx);
      setEntryBufferMin(initialEntryBufferMin);
      setExitBufferMin(initialExitBufferMin);
      setDailyGoalEnabled(editingPlace.dailyGoalMinutes != null);
      if (editingPlace.dailyGoalMinutes != null) {
        setDailyGoalHours(
          Math.max(DAILY_GOAL_MIN_H, Math.round(editingPlace.dailyGoalMinutes / 60)),
        );
      }
      setDailyGoalDays(parseGoalDays(editingPlace.dailyGoalDays));
      setWeeklyGoalEnabled(editingPlace.weeklyGoalMinutes != null);
      if (editingPlace.weeklyGoalMinutes != null) {
        setWeeklyGoalHours(
          Math.max(WEEKLY_GOAL_MIN_H, Math.round(editingPlace.weeklyGoalMinutes / 60)),
        );
      }
    } else if (!visible) {
      setQuery("");
      setSelected(null);
      setName("");
      setRadius(RADIUS_DEFAULT);
      setColorIdx(0);
      setIconIdx(0);
      setSuggestions([]);
      setApiError(null);
      setEntryBufferMin(initialEntryBufferMin);
      setExitBufferMin(initialExitBufferMin);
      setDailyGoalEnabled(false);
      setDailyGoalHours(DAILY_GOAL_DEFAULT_H);
      setDailyGoalDays([]);
      setWeeklyGoalEnabled(false);
      setWeeklyGoalHours(WEEKLY_GOAL_DEFAULT_H);
    }
  }, [
    editingPlace,
    visible,
    initialColorIdx,
    initialIconIdx,
    initialEntryBufferMin,
    initialExitBufferMin,
    pendingPlaceForm,
    placeId,
    source,
    setPendingPlaceForm,
  ]);

  return {
    editing,
    editingPlace,
    query,
    setQuery,
    suggestions,
    setSuggestions,
    searching,
    setSearching,
    apiError,
    setApiError,
    selected,
    setSelected,
    name,
    setName,
    radius,
    setRadius,
    colorIdx,
    setColorIdx,
    iconIdx,
    setIconIdx,
    resolvingPick,
    setResolvingPick,
    entryBufferMin,
    setEntryBufferMin,
    exitBufferMin,
    setExitBufferMin,
    dailyGoalEnabled,
    setDailyGoalEnabled,
    dailyGoalHours,
    setDailyGoalHours,
    dailyGoalDays,
    setDailyGoalDays,
    weeklyGoalEnabled,
    setWeeklyGoalEnabled,
    weeklyGoalHours,
    setWeeklyGoalHours,
  };
}
