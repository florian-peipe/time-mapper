import React, { useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Sheet } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { i18n } from "@/lib/i18n";
import type { Place } from "@/db/schema";
import { PlacePickerSection } from "./PlacePickerSection";
import { TimePickersSection } from "./TimePickersSection";
import { NoteSection } from "./NoteSection";
import { NetDurationReadout } from "./NetDurationReadout";
import { useEntryEditForm } from "./useEntryEditForm";
import { useEntryEditPersist } from "./useEntryEditPersist";

export type EntryEditSheetProps = {
  visible: boolean;
  /** null → "New entry" mode. Otherwise hydrate from the stored entry. */
  entryId: string | null;
  onClose: () => void;
  /** ISO date string — when set, new entries default to this date (09:00–10:00). */
  defaultDate?: string | null;
};

export function EntryEditSheet({ visible, entryId, onClose, defaultDate }: EntryEditSheetProps) {
  const t = useTheme();
  const { places } = usePlaces();

  const isNew = entryId == null;

  const {
    placeId,
    setPlaceId,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    pauseDate,
    setPauseDate,
    note,
    setNote,
    entrySource,
    grossMin,
    pauseMin,
    netMin,
  } = useEntryEditForm(entryId, places, defaultDate);

  // When New mode and places load, default placeId to the first place.
  useEffect(() => {
    if (!entryId && placeId == null && places.length > 0) {
      const first = places[0];
      if (first) setPlaceId(first.id);
    }
  }, [entryId, placeId, places, setPlaceId]);

  const selectedPlace: Place | null = useMemo(() => {
    if (!placeId) return null;
    return places.find((p) => p.id === placeId) ?? null;
  }, [placeId, places]);

  const { handleSave, handleDelete } = useEntryEditPersist({
    entryId,
    placeId,
    startDate,
    endDate,
    pauseDate,
    note,
    onClose,
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={86}
      title={isNew ? i18n.t("entryEdit.title.new") : i18n.t("entryEdit.title.edit")}
      testID="entry-edit-sheet"
      rightAccessory={
        <Pressable
          onPress={handleSave}
          testID="entry-edit-save"
          accessibilityRole="button"
          accessibilityLabel={i18n.t("entryEdit.label.saveEntry")}
          hitSlop={8}
          style={{
            paddingVertical: 7,
            paddingHorizontal: t.space[4] - 2,
            backgroundColor: t.color("color.accent"),
            borderRadius: t.radius.pill,
          }}
        >
          <Text
            style={{
              color: t.color("color.accent.contrast"),
              fontSize: t.type.size.s,
              fontWeight: t.type.weight.semibold,
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("entryEdit.label.save")}
          </Text>
        </Pressable>
      }
    >
      <NetDurationReadout grossMin={grossMin} pauseMin={pauseMin} netMin={netMin} />

      <PlacePickerSection places={places} selectedPlace={selectedPlace} onSelect={setPlaceId} />

      <TimePickersSection
        startDate={startDate}
        endDate={endDate}
        pauseDate={pauseDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onPauseDateChange={setPauseDate}
      />

      <NoteSection value={note} onChangeText={setNote} />

      {/* Source chip — centered neutral pill when an entry source exists. */}
      {entrySource ? (
        <View style={{ alignItems: "center", marginBottom: t.space[3] }}>
          <View
            style={{
              paddingVertical: t.space[1],
              paddingHorizontal: t.space[3] - 2,
              borderRadius: t.radius.pill,
              backgroundColor: t.color("color.surface2"),
              borderWidth: 1,
              borderColor: t.color("color.border"),
            }}
          >
            <Text
              style={{
                fontSize: t.type.size.xs,
                fontWeight: t.type.weight.semibold,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              {entrySource === "auto"
                ? i18n.t("entryEdit.label.sourceAuto")
                : i18n.t("entryEdit.label.sourceManual")}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Delete — only in Edit mode. */}
      {!isNew ? (
        <View style={{ marginTop: t.space[1], marginBottom: t.space[6] }}>
          <Button variant="destructive" size="md" full testID="entry-edit-delete" onPress={handleDelete}>
            {i18n.t("entryEdit.label.delete")}
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}
