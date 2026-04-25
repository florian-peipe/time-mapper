import { Alert } from "react-native";
import { PLACE_COLORS } from "@/theme/tokens";
import { openPaywall } from "@/features/billing/openPaywall";
import { useSnackbarStore } from "@/state/snackbarStore";
import { useSheetStore, type AddPlaceSource, type PendingPlaceForm } from "@/state/sheetStore";
import { MAX_PLACES } from "@/features/tracking/geofenceService";
import { i18n } from "@/lib/i18n";
import type { Place } from "@/db/schema";
import { type CreatePlaceInput } from "@/db/repository/places";
import { ICON_CHOICES, type Selection } from "./usePlaceForm";

type PlaceOps = {
  create: (input: CreatePlaceInput) => Place;
  update: (id: string, patch: Partial<CreatePlaceInput>) => Place;
  remove: (id: string) => void;
  restore: (id: string) => void;
  count: number;
};

type FormFields = {
  editing: boolean;
  selected: Selection | null;
  name: string;
  radius: number;
  colorIdx: number;
  iconIdx: number;
  entryBufferMin: number;
  exitBufferMin: number;
  dailyGoalEnabled: boolean;
  dailyGoalHours: number;
  dailyGoalDays: number[];
  weeklyGoalEnabled: boolean;
  weeklyGoalHours: number;
  setApiError: (v: string | null) => void;
};

type Opts = {
  placeId: string | null;
  source: AddPlaceSource | undefined;
  isPro: boolean;
  form: FormFields;
  placeOps: PlaceOps;
  onClose: () => void;
  onSaved?: (placeId: string) => void;
};

function buildGoalDays(enabled: boolean, days: number[]): string | null {
  if (!enabled || days.length === 0 || days.length >= 7) return null;
  return days
    .slice()
    .sort((a, b) => a - b)
    .join(",");
}

export function useAddPlaceSave({ placeId, source, isPro, form, placeOps, onClose, onSaved }: Opts) {
  const setPendingPlaceForm = useSheetStore((s) => s.setPendingPlaceForm);
  const {
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
  } = form;
  const { create, update, remove, restore, count } = placeOps;

  const shouldPaywall = !isPro && count >= 1 && !editing;

  const handleSave = () => {
    if (shouldPaywall) {
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
          dailyGoalDays: buildGoalDays(dailyGoalEnabled, dailyGoalDays),
        };
        setPendingPlaceForm(stash);
      }
      openPaywall({ source: "2nd-place" });
      return;
    }
    if (!editing && count >= MAX_PLACES) {
      Alert.alert(i18n.t("tracking.placeLimit.title"), i18n.t("tracking.placeLimit.body"), [
        { text: i18n.t("tracking.placeLimit.ok") },
      ]);
      return;
    }
    if (!selected) return;
    if (!editing && selected.latitude === 0 && selected.longitude === 0) {
      setApiError(i18n.t("addPlace.search.errorBody"));
      return;
    }
    const chosenColor = PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0];
    const chosenIcon = ICON_CHOICES[iconIdx] ?? ICON_CHOICES[0];
    const buffers = { entryBufferS: entryBufferMin * 60, exitBufferS: exitBufferMin * 60 };
    const goals = {
      dailyGoalMinutes: dailyGoalEnabled ? dailyGoalHours * 60 : null,
      weeklyGoalMinutes: weeklyGoalEnabled ? weeklyGoalHours * 60 : null,
      dailyGoalDays: buildGoalDays(dailyGoalEnabled, dailyGoalDays),
    };

    let saved: Place;
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
          useSnackbarStore.getState().show({
            message: i18n.t("addPlace.delete.snack"),
            action: {
              label: i18n.t("addPlace.delete.undo"),
              onPress: () => {
                try {
                  restore(placeId);
                } catch {
                  // Row was hard-purged already.
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

  return { handleSave, handleDelete, shouldPaywall };
}
