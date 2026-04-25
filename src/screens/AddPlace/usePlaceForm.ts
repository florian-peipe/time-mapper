/**
 * Form-state hook for the AddPlaceSheet. Owns every piece of mutable state
 * the sheet needs, including:
 *
 *   - Phase-1 search: `query`, `suggestions`, `searching`, `apiError`
 *   - Phase-2 form:   `selected`, `name`, `radius`, `colorIdx`, `iconIdx`,
 *                     buffer sliders, goal toggles + hour sliders + day filter
 *
 * Hydration priority (highest first):
 *   1. `pendingPlaceForm` from the sheet store (post-paywall restore).
 *   2. `editingPlace` — the place being edited.
 *   3. Defaults (for the "new place" flow).
 */
import { useEffect, useMemo, useRef, useState } from "react";
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

type FieldDefaults = {
  colorIdx: number;
  iconIdx: number;
  entryBufferMin: number;
  exitBufferMin: number;
};

/** Computes initial field values for a new or edited place. */
function defaultFieldValues(editingPlace: Place | null, kv: KvRepo): FieldDefaults {
  const { entryBufferS, exitBufferS } = readGlobalBuffers(kv);
  const colorIdx = editingPlace
    ? Math.max(0, PLACE_COLORS.findIndex((c) => c === editingPlace.color))
    : 0;
  const iconIdx = editingPlace
    ? Math.max(0, ICON_CHOICES.findIndex((i) => i === editingPlace.icon))
    : 0;
  const entryBufferMin = editingPlace
    ? Math.round((editingPlace.entryBufferS ?? 300) / 60)
    : Math.round(entryBufferS / 60);
  const exitBufferMin = editingPlace
    ? Math.round((editingPlace.exitBufferS ?? 180) / 60)
    : Math.round(exitBufferS / 60);
  return { colorIdx, iconIdx, entryBufferMin, exitBufferMin };
}

type PlaceFormValues = FieldDefaults & {
  selected: Selection;
  name: string;
  radius: number;
  dailyGoalEnabled: boolean;
  dailyGoalHours: number;
  dailyGoalDays: number[];
  weeklyGoalEnabled: boolean;
  weeklyGoalHours: number;
};

/** Maps a Place row into form field values ready to apply to state. */
function hydrateFromPlace(place: Place, defaults: FieldDefaults): PlaceFormValues {
  return {
    ...defaults,
    selected: { description: place.address, latitude: place.latitude, longitude: place.longitude },
    name: place.name,
    radius: place.radiusM,
    dailyGoalEnabled: place.dailyGoalMinutes != null,
    dailyGoalHours:
      place.dailyGoalMinutes != null
        ? Math.max(DAILY_GOAL_MIN_H, Math.round(place.dailyGoalMinutes / 60))
        : DAILY_GOAL_DEFAULT_H,
    dailyGoalDays: parseGoalDays(place.dailyGoalDays),
    weeklyGoalEnabled: place.weeklyGoalMinutes != null,
    weeklyGoalHours:
      place.weeklyGoalMinutes != null
        ? Math.max(WEEKLY_GOAL_MIN_H, Math.round(place.weeklyGoalMinutes / 60))
        : WEEKLY_GOAL_DEFAULT_H,
  };
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

  const defaults = useMemo(() => defaultFieldValues(editingPlace, kv), [editingPlace, kv]);

  // Phase-1 state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resolvingPick, setResolvingPick] = useState(false);

  // Phase-2 state
  const [selected, setSelected] = useState<Selection | null>(
    editingPlace
      ? { description: editingPlace.address, latitude: editingPlace.latitude, longitude: editingPlace.longitude }
      : null,
  );
  const [name, setName] = useState(editingPlace?.name ?? "");
  const [radius, setRadius] = useState(editingPlace?.radiusM ?? RADIUS_DEFAULT);
  const [colorIdx, setColorIdx] = useState(defaults.colorIdx);
  const [iconIdx, setIconIdx] = useState(defaults.iconIdx);
  const [entryBufferMin, setEntryBufferMin] = useState(defaults.entryBufferMin);
  const [exitBufferMin, setExitBufferMin] = useState(defaults.exitBufferMin);
  const [dailyGoalEnabled, setDailyGoalEnabled] = useState(
    editingPlace?.dailyGoalMinutes != null,
  );
  const [dailyGoalHours, setDailyGoalHours] = useState(
    editingPlace?.dailyGoalMinutes != null
      ? Math.max(DAILY_GOAL_MIN_H, Math.round(editingPlace.dailyGoalMinutes / 60))
      : DAILY_GOAL_DEFAULT_H,
  );
  const [dailyGoalDays, setDailyGoalDays] = useState<number[]>(
    parseGoalDays(editingPlace?.dailyGoalDays ?? null),
  );
  const [weeklyGoalEnabled, setWeeklyGoalEnabled] = useState(
    editingPlace?.weeklyGoalMinutes != null,
  );
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(
    editingPlace?.weeklyGoalMinutes != null
      ? Math.max(WEEKLY_GOAL_MIN_H, Math.round(editingPlace.weeklyGoalMinutes / 60))
      : WEEKLY_GOAL_DEFAULT_H,
  );

  // Track the previous visible state so we can detect the false→true transition.
  const prevVisible = useRef(false);

  // Hydration: pendingPlaceForm (post-paywall) > editingPlace > reset-on-close.
  useEffect(() => {
    const justOpened = visible && !prevVisible.current;
    prevVisible.current = visible;

    if (
      justOpened &&
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
      const vals = hydrateFromPlace(editingPlace, defaults);
      setSelected(vals.selected);
      setName(vals.name);
      setRadius(vals.radius);
      setColorIdx(vals.colorIdx);
      setIconIdx(vals.iconIdx);
      setEntryBufferMin(vals.entryBufferMin);
      setExitBufferMin(vals.exitBufferMin);
      setDailyGoalEnabled(vals.dailyGoalEnabled);
      if (vals.dailyGoalEnabled) setDailyGoalHours(vals.dailyGoalHours);
      setDailyGoalDays(vals.dailyGoalDays);
      setWeeklyGoalEnabled(vals.weeklyGoalEnabled);
      if (vals.weeklyGoalEnabled) setWeeklyGoalHours(vals.weeklyGoalHours);
    } else if (!visible) {
      setQuery("");
      setSelected(null);
      setName("");
      setRadius(RADIUS_DEFAULT);
      setColorIdx(0);
      setIconIdx(0);
      setSuggestions([]);
      setApiError(null);
      setEntryBufferMin(defaults.entryBufferMin);
      setExitBufferMin(defaults.exitBufferMin);
      setDailyGoalEnabled(false);
      setDailyGoalHours(DAILY_GOAL_DEFAULT_H);
      setDailyGoalDays([]);
      setWeeklyGoalEnabled(false);
      setWeeklyGoalHours(WEEKLY_GOAL_DEFAULT_H);
    }
  }, [
    editingPlace,
    visible,
    defaults,
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
