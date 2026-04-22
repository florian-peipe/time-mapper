import React, { useEffect } from "react";
import { Alert, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { PLACE_COLORS } from "@/theme/tokens";
import { Button, Sheet } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { usePro } from "@/features/billing/usePro";
import { openPaywall } from "@/features/billing/openPaywall";
import { useSnackbarStore } from "@/state/snackbarStore";
import { useSheetStore, type AddPlaceSource, type PendingPlaceForm } from "@/state/sheetStore";
import { MAX_PLACES } from "@/features/tracking/geofenceService";
import { useKvRepo } from "@/features/onboarding/useOnboardingGate";
import { i18n } from "@/lib/i18n";
import { autocomplete, geocodePlace, type PlaceSuggestion } from "@/lib/geocode";
import { Phase1SearchStep } from "./Phase1SearchStep";
import { Phase2DetailsForm } from "./Phase2DetailsForm";
import { usePlaceForm, ICON_CHOICES } from "./usePlaceForm";

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

const AUTOCOMPLETE_DEBOUNCE_MS = 300;

export function AddPlaceSheet({ visible, placeId, source, onClose, onSaved }: AddPlaceSheetProps) {
  const t = useTheme();
  const { places, create, update, remove, restore, count } = usePlaces();
  const { isPro } = usePro();
  const setPendingPlaceForm = useSheetStore((s) => s.setPendingPlaceForm);
  const kv = useKvRepo();

  const form = usePlaceForm({ placeId, visible, source, places, kv });
  const {
    editing,
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
  } = form;

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
  }, [query, editing, selected, setSuggestions, setSearching, setApiError]);

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
      openPaywall({ source: "2nd-place" });
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
        <Phase1SearchStep
          query={query}
          suggestions={suggestions}
          searching={searching}
          apiError={apiError}
          onChangeQuery={setQuery}
          onPickSuggestion={(s) => {
            void handlePickSuggestion(s);
          }}
        />
      ) : (
        <Phase2DetailsForm
          visible={visible}
          selected={selected}
          name={name}
          onChangeName={setName}
          radius={radius}
          onChangeRadius={setRadius}
          colorIdx={colorIdx}
          onChangeColorIdx={setColorIdx}
          iconIdx={iconIdx}
          onChangeIconIdx={setIconIdx}
          entryBufferMin={entryBufferMin}
          onChangeEntryBufferMin={setEntryBufferMin}
          exitBufferMin={exitBufferMin}
          onChangeExitBufferMin={setExitBufferMin}
          dailyGoalEnabled={dailyGoalEnabled}
          onChangeDailyGoalEnabled={setDailyGoalEnabled}
          dailyGoalHours={dailyGoalHours}
          onChangeDailyGoalHours={setDailyGoalHours}
          dailyGoalDays={dailyGoalDays}
          onChangeDailyGoalDays={setDailyGoalDays}
          weeklyGoalEnabled={weeklyGoalEnabled}
          onChangeWeeklyGoalEnabled={setWeeklyGoalEnabled}
          weeklyGoalHours={weeklyGoalHours}
          onChangeWeeklyGoalHours={setWeeklyGoalHours}
        />
      )}
    </Sheet>
  );
}
