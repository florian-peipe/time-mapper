import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { PLACE_COLORS } from "@/theme/tokens";
import { Banner, Button, DayPicker, Icon, Input, Sheet, Toggle, type IconName } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { usePro } from "@/features/billing/usePro";
import { useSnackbarStore } from "@/state/snackbarStore";
import { useSheetStore, type AddPlaceSource, type PendingPlaceForm } from "@/state/sheetStore";
import { MAX_PLACES } from "@/features/tracking/geofenceService";
import { useKvRepo } from "@/features/onboarding/useOnboardingGate";
import { i18n } from "@/lib/i18n";
import { autocomplete, geocodePlace, type PlaceSuggestion } from "@/lib/geocode";
import { readGlobalBuffers } from "@/screens/Settings/BuffersSheet";
import { MapPreview } from "./MapPreview";

export type AddPlaceSheetProps = {
  visible: boolean;
  /** null → New place. Non-null → edit that place. */
  placeId: string | null;
  /**
   * Optional marker of where the sheet was opened from. Currently only
   * `"onboarding"` drives extra behavior (calls `onSaved` so the gate can
   * mark onboarding complete). Other sources are plain string tags used for
   * analytics / debugging.
   */
  source?: AddPlaceSource;
  onClose: () => void;
  /**
   * Fired after a successful save (create OR update). Lets the onboarding
   * flow mark itself complete and navigate to the tabs without knowing the
   * AddPlaceSheet internals. For non-onboarding opens the host just passes
   * `undefined` and this becomes a no-op.
   */
  onSaved?: (placeId: string) => void;
};

/** Internal selection state — either from an autocomplete pick or an edit. */
type Selection = {
  description: string;
  placeId?: string;
  latitude: number;
  longitude: number;
};

/** Parse `places.dailyGoalDays` into a sorted array of ISO day numbers. */
function parseGoalDays(raw: string | null | undefined): number[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
}

/** The 9 icons users can assign to a place. */
const ICON_CHOICES: readonly IconName[] = [
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

const RADIUS_MIN = 25;
const RADIUS_MAX = 300;
const RADIUS_DEFAULT = 50;
const AUTOCOMPLETE_DEBOUNCE_MS = 300;

// Per-place buffer slider bounds (minutes). Entry bias tends to be longer
// than exit bias — matches the design of the state machine's dwell
// thresholds (entry buffer protects against false-positive entries, exit
// buffer collapses brief re-entries into the same entry).
const ENTRY_BUFFER_MIN_MIN = 1;
const ENTRY_BUFFER_MAX_MIN = 15;
const EXIT_BUFFER_MIN_MIN = 1;
const EXIT_BUFFER_MAX_MIN = 10;

// Per-place time-goal sliders. Hours (not minutes) — larger granularity,
// matches how a user thinks about a weekly / daily target. 0 = disabled.
const DAILY_GOAL_MIN_H = 1;
const DAILY_GOAL_MAX_H = 16;
const DAILY_GOAL_DEFAULT_H = 8;
const WEEKLY_GOAL_MIN_H = 1;
const WEEKLY_GOAL_MAX_H = 80;
const WEEKLY_GOAL_DEFAULT_H = 40;

export function AddPlaceSheet({ visible, placeId, source, onClose, onSaved }: AddPlaceSheetProps) {
  const t = useTheme();
  const { places, create, update, remove, restore, count } = usePlaces();
  const { isPro } = usePro();
  const openSheet = useSheetStore((s) => s.openSheet);
  const pendingPlaceForm = useSheetStore((s) => s.pendingPlaceForm);
  const setPendingPlaceForm = useSheetStore((s) => s.setPendingPlaceForm);
  const kv = useKvRepo();

  const editing = placeId != null;
  const editingPlace = useMemo(
    () => (placeId ? (places.find((p) => p.id === placeId) ?? null) : null),
    [places, placeId],
  );

  // Resolve the initial color/icon index from an edited place. Defaults to
  // index 0 if the stored value isn't one of the chosen lists (old data,
  // truncated color, etc.).
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

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  // Tracks whether a suggestion is being resolved via geocodePlace — used to
  // block Save in Phase 2 while coords are still arriving, preventing a
  // race where the user can save before lat/lng land.
  const [resolvingPick, setResolvingPick] = useState(false);
  // Tracks whether autocomplete is currently fetching. Drives the spinner
  // hint shown below the search input.
  const [searching, setSearching] = useState(false);
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
  const [apiError, setApiError] = useState<string | null>(null);

  // Per-place buffer defaults. New places pre-fill from the global KV
  // defaults (set via Settings → Default buffers); edited places keep
  // their existing values. UI operates on minutes, persists in seconds.
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
  const [entryBufferMin, setEntryBufferMin] = useState(initialEntryBufferMin);
  const [exitBufferMin, setExitBufferMin] = useState(initialExitBufferMin);

  // Goals — store the hour value locally for each slider + a separate
  // `enabled` flag. When disabled, the slider is greyed out and Save
  // persists `null` for the column. The hour defaults (8 daily / 40 weekly)
  // are just starting positions — only applied when the user flips the
  // toggle on, then tweaks the slider.
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

  // When the sheet is reused for a different placeId (edit vs. new vs.
  // another edit), re-hydrate the local state so stale values from the
  // previous instance don't leak through. Also resets when the sheet is
  // hidden so reopening gives a clean slate.
  useEffect(() => {
    // Restoration path — if the sheet is reopened after a paywall hop and
    // the store holds a `pendingPlaceForm`, hydrate Phase 2 from that and
    // clear the slot so subsequent opens start fresh. This takes priority
    // over the edit-mode rehydration.
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

  // Autocomplete debounce. Every keystroke schedules a Photon call 300ms
  // later; if the user keeps typing we cancel the prior fetch via
  // AbortController and reschedule. Short queries (<2 chars) return
  // nothing; on network failure the `failed` flag surfaces an offline
  // banner in the UI.
  useEffect(() => {
    if (editing || selected) return;
    let cancelled = false;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const { suggestions: results, failed } = await autocomplete(query, controller.signal);
          if (!cancelled) {
            setSuggestions(results);
            setApiError(failed ? "offline" : null);
          }
        } catch (err) {
          if (cancelled) return;
          // Ignore aborts — they just mean a newer keystroke superseded us.
          if (err instanceof Error && err.name === "AbortError") return;
          const msg = err instanceof Error ? err.message : String(err);
          setApiError(msg);
          setSuggestions([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(handle);
    };
  }, [query, editing, selected]);

  // Pro gate only applies when the user is trying to create an ADDITIONAL
  // place on the free plan. Edit mode (placeId !== null) is never gated.
  const shouldPaywall = !isPro && count >= 1 && !editing;

  const handlePickSuggestion = async (s: PlaceSuggestion) => {
    // Intentionally leave `name` blank — the user labels the place ("Arbeit",
    // "Sport", …); the picked address is shown separately in the preview card.
    setResolvingPick(true);
    try {
      const details = await geocodePlace(s.placeId);
      setSelected({
        description: details.formattedAddress || s.description,
        placeId: s.placeId,
        latitude: details.lat,
        longitude: details.lng,
      });
      setApiError(null);
    } catch (err) {
      // If geocoding fails, still let the user proceed with description
      // only (lat/lng zero). Surface the error in a Banner. The Save guard
      // (in handleSave) refuses 0/0 coords so the user can't accidentally
      // create a broken place.
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(msg);
      setSelected({
        description: s.description,
        placeId: s.placeId,
        latitude: 0,
        longitude: 0,
      });
    } finally {
      setResolvingPick(false);
    }
  };

  const handleSave = () => {
    if (shouldPaywall) {
      // Stash the current form so the sheet can rehydrate after the user
      // returns from a successful purchase. Clearing happens after the
      // restore picks it up (see the hydration effect below).
      if (selected) {
        const stash: PendingPlaceForm = {
          placeId,
          source,
          description: selected.description,
          latitude: selected.latitude,
          longitude: selected.longitude,
          name,
          radiusM: radius,
          colorIdx,
          iconIdx,
          entryBufferMin,
          exitBufferMin,
          dailyGoalMinutes: dailyGoalEnabled ? dailyGoalHours * 60 : null,
          weeklyGoalMinutes: weeklyGoalEnabled ? weeklyGoalHours * 60 : null,
          dailyGoalDays:
            dailyGoalEnabled && dailyGoalDays.length > 0 && dailyGoalDays.length < 7
              ? dailyGoalDays
                  .slice()
                  .sort((a, b) => a - b)
                  .join(",")
              : null,
        };
        setPendingPlaceForm(stash);
      }
      openSheet("paywall", { source: "2nd-place" });
      return;
    }
    // iOS caps geofence regions at 20. We enforce the same limit on Android
    // for consistency and because the state machine + reconcile loop both
    // assume a bounded set. Edit mode is never gated (the place already
    // exists, we're not adding one).
    if (!editing && count >= MAX_PLACES) {
      Alert.alert(i18n.t("tracking.placeLimit.title"), i18n.t("tracking.placeLimit.body"), [
        { text: i18n.t("tracking.placeLimit.ok") },
      ]);
      return;
    }
    if (!selected) return;
    // Defensive: a geocodePlace failure leaves lat=lng=0 on `selected`. A
    // geofence at Null Island will never fire — refuse to save a fresh
    // place with unresolved coords and leave the Banner in place so the
    // user picks another suggestion. We scope to new-place mode only —
    // edit mode preserves whatever coords were already on the row (which
    // could legitimately be 0/0 on legacy data).
    if (!editing && selected.latitude === 0 && selected.longitude === 0) {
      setApiError(i18n.t("addPlace.search.errorBody"));
      return;
    }
    const chosenColor = PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0];
    const chosenIcon = ICON_CHOICES[iconIdx] ?? ICON_CHOICES[0];

    let saved;
    const buffers = {
      entryBufferS: entryBufferMin * 60,
      exitBufferS: exitBufferMin * 60,
    };
    const goals = {
      dailyGoalMinutes: dailyGoalEnabled ? dailyGoalHours * 60 : null,
      weeklyGoalMinutes: weeklyGoalEnabled ? weeklyGoalHours * 60 : null,
      // Normalize "every day" (empty or all-7 selection) to null so the
      // notifier/stats fall through the simple "no filter" path.
      dailyGoalDays:
        dailyGoalEnabled && dailyGoalDays.length > 0 && dailyGoalDays.length < 7
          ? dailyGoalDays
              .slice()
              .sort((a, b) => a - b)
              .join(",")
          : null,
    };
    if (editing && placeId) {
      saved = update(placeId, {
        name: name.trim() || selected.description,
        address: selected.description,
        latitude: selected.latitude,
        longitude: selected.longitude,
        radiusM: radius,
        color: chosenColor,
        icon: chosenIcon,
        ...buffers,
        ...goals,
      });
    } else {
      saved = create({
        name: name.trim() || selected.description,
        address: selected.description,
        latitude: selected.latitude,
        longitude: selected.longitude,
        radiusM: radius,
        color: chosenColor,
        icon: chosenIcon,
        ...buffers,
        ...goals,
      });
    }
    onSaved?.(saved.id);
    onClose();
  };

  const handleDelete = () => {
    if (!placeId) return;
    Alert.alert(i18n.t("addPlace.delete.title"), i18n.t("addPlace.delete.body"), [
      { text: i18n.t("common.cancel"), style: "cancel" },
      {
        text: i18n.t("common.delete"),
        style: "destructive",
        onPress: () => {
          remove(placeId);
          // Offer a 5 s Undo via the global snackbar — mirrors the pattern
          // used by EntryEditSheet so delete recovery feels symmetric
          // across the two object types.
          useSnackbarStore.getState().show({
            message: i18n.t("addPlace.delete.snack"),
            action: {
              label: i18n.t("addPlace.delete.undo"),
              onPress: () => {
                try {
                  restore(placeId);
                } catch {
                  // Row was hard-purged already — nothing we can do.
                }
              },
            },
            ttlMs: 5000,
          });
          onClose();
        },
      },
    ]);
  };

  const saveLabel = shouldPaywall
    ? i18n.t("addPlace.cta.unlockPro")
    : editing
      ? i18n.t("addPlace.cta.saveChanges")
      : i18n.t("addPlace.cta.savePlace");
  const sheetTitle = editing ? i18n.t("addPlace.title.edit") : i18n.t("addPlace.title.new");

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={88}
      title={sheetTitle}
      testID="add-place-sheet"
      footer={
        selected ? (
          <View style={{ gap: t.space[2] }}>
            <Button
              variant="primary"
              size="md"
              full
              onPress={handleSave}
              loading={resolvingPick}
              disabled={resolvingPick}
              testID="add-place-save"
              accessibilityLabel={saveLabel}
              accessibilityHint={shouldPaywall ? i18n.t("addPlace.cta.unlockPro.hint") : undefined}
            >
              {saveLabel}
            </Button>
            {editing ? (
              <Button
                variant="destructive"
                size="md"
                full
                onPress={handleDelete}
                testID="add-place-delete"
                accessibilityLabel={i18n.t("addPlace.delete.cta")}
                accessibilityHint={i18n.t("addPlace.delete.hint")}
              >
                {i18n.t("addPlace.delete.cta")}
              </Button>
            ) : null}
          </View>
        ) : null
      }
    >
      {!selected ? (
        <>
          <Input
            testID="add-place-search"
            autoFocus
            placeholder={i18n.t("addPlace.search.placeholder")}
            value={query}
            onChangeText={setQuery}
            leading="search"
            containerStyle={{ marginBottom: t.space[3] }}
            accessibilityLabel={i18n.t("addPlace.search.placeholder")}
            accessibilityHint={i18n.t("addPlace.search.hint")}
          />
          {apiError ? (
            <View style={{ marginBottom: t.space[3] }}>
              <Banner
                tone="warning"
                title={i18n.t("addPlace.search.errorTitle")}
                body={i18n.t("addPlace.search.errorBody")}
                testID="add-place-api-error"
              />
            </View>
          ) : null}
          {searching ? (
            <View
              testID="add-place-searching"
              accessible
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: t.space[2],
                paddingVertical: t.space[2],
                paddingHorizontal: t.space[1],
              }}
            >
              <ActivityIndicator size="small" color={t.color("color.accent")} />
              <Text
                style={{
                  fontSize: t.type.size.s,
                  color: t.color("color.fg3"),
                  fontFamily: t.type.family.sans,
                }}
              >
                {i18n.t("addPlace.search.searching")}
              </Text>
            </View>
          ) : null}
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.placeId}-${i}`}
              testID={`add-place-suggestion-${i}`}
              onPress={() => {
                void handlePickSuggestion(s);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${s.mainText}, ${s.secondaryText}`}
              accessibilityHint={i18n.t("addPlace.suggestion.hint")}
              hitSlop={t.space[2]}
              style={{
                flexDirection: "row",
                gap: t.space[3],
                paddingVertical: t.space[3],
                paddingHorizontal: t.space[1],
                borderBottomWidth: 1,
                borderBottomColor: t.color("color.border"),
                minHeight: t.minTouchTarget,
              }}
            >
              <View style={{ marginTop: 2 }}>
                <Icon
                  name="map-pin"
                  size={18}
                  color={t.color("color.fg3")}
                  accessibilityLabel={i18n.t("addPlace.icon.pin")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: t.type.size.body,
                    color: t.color("color.fg"),
                    fontFamily: t.type.family.sans,
                  }}
                >
                  {s.mainText || s.description}
                </Text>
                <Text
                  style={{
                    fontSize: t.type.size.xs + 1, // design-source: secondary 12
                    color: t.color("color.fg3"),
                    fontFamily: t.type.family.sans,
                    marginTop: 2,
                  }}
                >
                  {s.secondaryText}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : (
        <View style={{ flexDirection: "column", gap: t.space[5] - 2 }}>
          {/* Name field. */}
          <View style={{ flexDirection: "column", gap: t.space[1] + 2 }}>
            <Text
              accessibilityRole="text"
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
              }}
            >
              {i18n.t("addPlace.field.name")}
            </Text>
            <Input
              testID="add-place-name"
              value={name}
              onChangeText={setName}
              accessibilityLabel={i18n.t("addPlace.field.name")}
            />
          </View>

          {/* Address preview card. */}
          <View
            accessibilityRole="text"
            accessibilityLabel={`${i18n.t("addPlace.field.address")}, ${selected.description}`}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: t.space[3] - 2, // design-source: gap 10
              paddingVertical: t.space[3],
              paddingHorizontal: 14, // design-source: 14 horizontal
              backgroundColor: t.color("color.surface2"),
              borderRadius: t.radius.md - 2, // design-source: radius 10
            }}
          >
            <View style={{ marginTop: 2 }}>
              <Icon name="map-pin" size={18} color={t.color("color.fg2")} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: t.type.size.body - 1, // design-source: 14
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
              }}
            >
              {selected.description}
            </Text>
          </View>

          {/*
            Map preview — only rendered when we have real coordinates.
            Demo-mode picks (offline fallback) + freshly-resolved Photon
            picks both carry lat/lng. Hide the preview when either is 0
            rather than drawing a pin in the middle of the Atlantic.
          */}
          {selected.latitude !== 0 || selected.longitude !== 0 ? (
            <MapPreview
              latitude={selected.latitude}
              longitude={selected.longitude}
              radiusM={radius}
              color={PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0]!}
              testID="add-place-map-preview"
            />
          ) : null}

          {/* Radius section. */}
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: t.space[2],
              }}
            >
              <Text
                accessibilityRole="text"
                style={{
                  fontSize: t.type.size.s,
                  color: t.color("color.fg2"),
                  fontFamily: t.type.family.sans,
                  fontWeight: t.type.weight.medium,
                }}
              >
                {i18n.t("addPlace.field.radius")}
              </Text>
              <Text
                style={{
                  fontSize: t.type.size.s,
                  color: t.color("color.fg"),
                  fontFamily: t.type.family.sans,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {radius} m
              </Text>
            </View>
            <Slider
              key={visible ? "radius-open" : "radius-closed"}
              testID="add-place-radius"
              minimumValue={RADIUS_MIN}
              maximumValue={RADIUS_MAX}
              step={1}
              value={radius}
              onValueChange={(v: number) => setRadius(Math.round(v))}
              minimumTrackTintColor={t.color("color.accent")}
              maximumTrackTintColor={t.color("color.border")}
              thumbTintColor={t.color("color.accent")}
              style={{ width: "100%", height: 28 }}
              accessibilityRole="adjustable"
              accessibilityLabel={i18n.t("addPlace.field.radius")}
              accessibilityValue={{
                min: RADIUS_MIN,
                max: RADIUS_MAX,
                now: radius,
                text: `${radius} m`,
              }}
              accessibilityHint={i18n.t("addPlace.field.radius.hint")}
            />
          </View>

          {/* Per-place entry + exit buffers. */}
          <BufferSliderRow
            label={i18n.t("addPlace.field.entryBuffer")}
            minutes={entryBufferMin}
            minValue={ENTRY_BUFFER_MIN_MIN}
            maxValue={ENTRY_BUFFER_MAX_MIN}
            onChange={setEntryBufferMin}
            testID="add-place-entry-buffer"
            visible={visible}
          />
          <BufferSliderRow
            label={i18n.t("addPlace.field.exitBuffer")}
            minutes={exitBufferMin}
            minValue={EXIT_BUFFER_MIN_MIN}
            maxValue={EXIT_BUFFER_MAX_MIN}
            onChange={setExitBufferMin}
            testID="add-place-exit-buffer"
            visible={visible}
          />

          {/* Goals — optional daily + weekly time targets. */}
          <View style={{ gap: t.space[2] }}>
            <Text
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
              }}
            >
              {i18n.t("addPlace.goals.title")}
            </Text>
            <Text
              style={{
                fontSize: t.type.size.xs,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
              }}
            >
              {i18n.t("addPlace.goals.body")}
            </Text>
          </View>
          <GoalSliderRow
            label={i18n.t("addPlace.goals.daily")}
            enabled={dailyGoalEnabled}
            hours={dailyGoalHours}
            minValue={DAILY_GOAL_MIN_H}
            maxValue={DAILY_GOAL_MAX_H}
            onToggle={setDailyGoalEnabled}
            onChangeHours={setDailyGoalHours}
            daysValue={dailyGoalDays}
            onDaysChange={setDailyGoalDays}
            testID="add-place-daily-goal"
          />
          <GoalSliderRow
            label={i18n.t("addPlace.goals.weekly")}
            enabled={weeklyGoalEnabled}
            hours={weeklyGoalHours}
            minValue={WEEKLY_GOAL_MIN_H}
            maxValue={WEEKLY_GOAL_MAX_H}
            onToggle={setWeeklyGoalEnabled}
            onChangeHours={setWeeklyGoalHours}
            testID="add-place-weekly-goal"
          />

          {/* Color picker. */}
          <View>
            <Text
              accessibilityRole="text"
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
                marginBottom: t.space[2],
              }}
            >
              {i18n.t("addPlace.field.color")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: t.space[2] + 2, // design-source: gap 10
                flexWrap: "wrap",
              }}
            >
              {PLACE_COLORS.map((c, i) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  selected={i === colorIdx}
                  onPress={() => setColorIdx(i)}
                  testID={`add-place-color-${i}`}
                />
              ))}
            </View>
          </View>

          {/* Icon picker grid (6 per row). */}
          <View>
            <Text
              accessibilityRole="text"
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
                marginBottom: t.space[2],
              }}
            >
              {i18n.t("addPlace.field.icon")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                // design-source: gap 8 between tiles on both axes
                gap: t.space[2],
              }}
            >
              {ICON_CHOICES.map((iconName, i) => (
                <IconTile
                  key={iconName}
                  name={iconName}
                  selected={i === iconIdx}
                  color={PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0]!}
                  onPress={() => setIconIdx(i)}
                  testID={`add-place-icon-${i}`}
                />
              ))}
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

/**
 * A 36×36 circular color chip. Selected state draws two nested rings
 * (3px bg + 2px fg) to signal the current choice.
 */
function ColorSwatch({
  color,
  selected,
  onPress,
  testID,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${i18n.t("addPlace.field.color")} ${color}`}
      accessibilityState={{ selected }}
      hitSlop={t.space[1]}
      style={{
        // Outer ring = bg-colour with 5px extra — only painted when selected.
        width: 46,
        height: 46,
        borderRadius: t.radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? t.color("color.fg") : "transparent",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: t.radius.pill,
          backgroundColor: t.color("color.bg"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            // design-source: inner swatch 36×36
            width: 36,
            height: 36,
            borderRadius: t.radius.pill,
            backgroundColor: color,
          }}
        />
      </View>
    </Pressable>
  );
}

/**
 * Per-place buffer slider row — label + current minutes readout + a slider.
 * Local component so the AddPlaceSheet form stays self-contained.
 */
function BufferSliderRow({
  label,
  minutes,
  minValue,
  maxValue,
  onChange,
  testID,
  visible,
}: {
  label: string;
  minutes: number;
  minValue: number;
  maxValue: number;
  onChange: (v: number) => void;
  testID?: string;
  /** Sheet visibility — used to force a Slider remount on open so the
   *  native iOS UISlider thumb syncs with the current `value` prop
   *  (known bug where the initial thumb position is wrong). */
  visible: boolean;
}) {
  const t = useTheme();
  const valueLabel = i18n.t("addPlace.field.bufferValue", { n: minutes });
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: t.space[2],
        }}
      >
        <Text
          accessibilityRole="text"
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            fontVariant: ["tabular-nums"],
          }}
          testID={testID ? `${testID}-value` : undefined}
        >
          {valueLabel}
        </Text>
      </View>
      <Slider
        key={visible ? "open" : "closed"}
        testID={testID}
        minimumValue={minValue}
        maximumValue={maxValue}
        step={1}
        value={minutes}
        onValueChange={(v: number) => onChange(Math.round(v))}
        minimumTrackTintColor={t.color("color.accent")}
        maximumTrackTintColor={t.color("color.border")}
        thumbTintColor={t.color("color.accent")}
        style={{ width: "100%", height: 28 }}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: minValue, max: maxValue, now: minutes, text: valueLabel }}
      />
    </View>
  );
}

/**
 * Toggle-guarded hour slider for the per-place daily / weekly goals.
 * When `enabled` is false the toggle sits alone and the slider is hidden;
 * flipping it on reveals the slider with the current `hours` value. The
 * toggle itself matches the geometry of the quiet-hours + digest toggles
 * in `NotificationsSheet`.
 */
function GoalSliderRow({
  label,
  enabled,
  hours,
  minValue,
  maxValue,
  onToggle,
  onChangeHours,
  daysValue,
  onDaysChange,
  testID,
}: {
  label: string;
  enabled: boolean;
  hours: number;
  minValue: number;
  maxValue: number;
  onToggle: (next: boolean) => void;
  onChangeHours: (v: number) => void;
  /** Optional day-of-week filter (only supplied for the daily goal). */
  daysValue?: number[];
  onDaysChange?: (next: number[]) => void;
  testID?: string;
}) {
  const t = useTheme();
  const valueLabel = i18n.t("addPlace.goals.hours", { n: hours });
  return (
    <View>
      <Pressable
        onPress={() => onToggle(!enabled)}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: enabled }}
        testID={testID ? `${testID}-toggle` : undefined}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: t.space[2],
        }}
      >
        <View style={{ flex: 1, paddingRight: t.space[3] }}>
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.medium,
            }}
          >
            {label}
          </Text>
          {enabled ? (
            <Text
              style={{
                marginTop: 2,
                fontSize: t.type.size.xs,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
                fontVariant: ["tabular-nums"],
              }}
            >
              {valueLabel}
            </Text>
          ) : null}
        </View>
        <Toggle checked={enabled} />
      </Pressable>
      {enabled ? (
        <Slider
          // Remount on toggle-on so the UISlider's thumb syncs with
          // the current `hours` value (native iOS bug workaround).
          key={`${testID}-${enabled ? "on" : "off"}`}
          testID={testID}
          minimumValue={minValue}
          maximumValue={maxValue}
          step={1}
          value={hours}
          onValueChange={(v: number) => onChangeHours(Math.round(v))}
          minimumTrackTintColor={t.color("color.accent")}
          maximumTrackTintColor={t.color("color.border")}
          thumbTintColor={t.color("color.accent")}
          style={{ width: "100%", height: 28 }}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: minValue, max: maxValue, now: hours, text: valueLabel }}
        />
      ) : null}
      {enabled && daysValue && onDaysChange ? (
        <View style={{ marginTop: t.space[2], gap: t.space[2] }}>
          <Text
            style={{
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("addPlace.goal.daily.days.title")}
          </Text>
          <DayPicker
            value={daysValue.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : daysValue}
            onChange={onDaysChange}
            testID={testID ? `${testID}-days` : undefined}
            accessibilityLabel={i18n.t("addPlace.goal.daily.days.hint")}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A square icon tile. Selected: filled with the current accent color + white
 * icon. Others: surface2 bg + fg2 icon. Design-source: AddPlaceSheet icon
 * grid (lines 407-414).
 */
function IconTile({
  name,
  selected,
  color,
  onPress,
  testID,
}: {
  name: IconName;
  selected: boolean;
  color: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${i18n.t("addPlace.field.icon")} ${name}`}
      accessibilityState={{ selected }}
      hitSlop={t.space[1]}
      style={{
        // design-source: 6 per row = (100% - 5 gaps of 8) / 6; we keep a
        // fixed square so the test environment width stays stable.
        width: 48,
        height: 48,
        borderRadius: t.radius.md - 2, // design-source: radius 10
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? color : t.color("color.surface2"),
      }}
    >
      <Icon
        name={name}
        size={20}
        color={selected ? t.color("color.accent.contrast") : t.color("color.fg2")}
      />
    </Pressable>
  );
}
