import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Sheet } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { usePro } from "@/features/billing/usePro";
import { useKvRepo } from "@/features/onboarding/useOnboardingGate";
import { i18n } from "@/lib/i18n";
import { geocodePlace, type PlaceSuggestion } from "@/lib/geocode";
import type { AddPlaceSource } from "@/state/sheetStore";
import { Phase1SearchStep } from "./Phase1SearchStep";
import { Phase2DetailsForm } from "./Phase2DetailsForm";
import { usePlaceForm } from "./usePlaceForm";
import { useAutocompleteSuggestions } from "./useAutocompleteSuggestions";
import { useAddPlaceSave } from "./useAddPlaceSave";

export type AddPlaceSheetProps = {
  visible: boolean;
  /** null → New place. Non-null → edit that place. */
  placeId: string | null;
  source?: AddPlaceSource;
  onClose: () => void;
  onSaved?: (placeId: string) => void;
};

export function AddPlaceSheet({ visible, placeId, source, onClose, onSaved }: AddPlaceSheetProps) {
  const t = useTheme();
  const { places, create, update, remove, restore, count } = usePlaces();
  const { isPro } = usePro();
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

  useAutocompleteSuggestions({ query, editing, selected, setSuggestions, setSearching, setApiError });

  const { handleSave, handleDelete, shouldPaywall } = useAddPlaceSave({
    placeId,
    source,
    isPro,
    form: {
      editing,
      selected,
      name,
      radius,
      colorIdx,
      iconIdx,
      entryBufferMin,
      exitBufferMin,
      dailyGoalEnabled,
      dailyGoalHours,
      dailyGoalDays,
      weeklyGoalEnabled,
      weeklyGoalHours,
      setApiError,
    },
    placeOps: { create, update, remove, restore, count },
    onClose,
    onSaved,
  });

  const handleEditAddress = () => {
    // Pre-fill Phase 1 with the current address description so the user
    // doesn't start from a blank search box (especially useful in edit mode).
    if (selected) setQuery(selected.description);
    setSelected(null);
  };

  const handlePickSuggestion = async (s: PlaceSuggestion) => {
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
          onRequestEditAddress={handleEditAddress}
        />
      )}
    </Sheet>
  );
}
