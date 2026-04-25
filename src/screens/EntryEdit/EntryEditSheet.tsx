import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Sheet } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { useEntriesRepo } from "@/features/entries/useEntries";
import { i18n } from "@/lib/i18n";
import { formatDurationCompact } from "@/lib/time";
import { useSnackbarStore } from "@/state/snackbarStore";
import { useDataVersionStore } from "@/state/dataVersionStore";
import type { Entry, Place } from "@/db/schema";
import { PlacePickerSection } from "./PlacePickerSection";
import { TimePickersSection } from "./TimePickersSection";
import { NoteSection } from "./NoteSection";
import { defaultEnd, defaultStart, pauseDateToMinutes, pauseMinutesToDate } from "./entryEditUtils";

export type EntryEditSheetProps = {
  visible: boolean;
  /** null → "New entry" mode. Otherwise hydrate from the stored entry. */
  entryId: string | null;
  onClose: () => void;
};

export function EntryEditSheet({ visible, entryId, onClose }: EntryEditSheetProps) {
  const t = useTheme();
  const { places } = usePlaces();
  const entriesRepo = useEntriesRepo();
  const bumpEntries = useDataVersionStore((s) => s.bumpEntries);

  const isNew = entryId == null;

  // Hydrate form state. Effects below rebuild state when entryId changes or
  // when places load (for the New-mode default place).
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => defaultStart(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => defaultEnd(new Date()));
  const [pauseDate, setPauseDate] = useState<Date>(() => pauseMinutesToDate(0));
  const [note, setNote] = useState<string>("");
  const [entrySource, setEntrySource] = useState<"auto" | "manual" | null>(null);

  // Hydrate from the selected entry (Edit mode) or apply defaults (New mode).
  useEffect(() => {
    if (entryId) {
      const e: Entry | null = entriesRepo.get(entryId);
      if (e) {
        setPlaceId(e.placeId);
        setStartDate(new Date(e.startedAt * 1000));
        setEndDate(
          e.endedAt != null ? new Date(e.endedAt * 1000) : defaultEnd(new Date(e.startedAt * 1000)),
        );
        setPauseDate(pauseMinutesToDate(Math.round((e.pauseS ?? 0) / 60)));
        setNote(e.note ?? "");
        setEntrySource(e.source);
      }
    } else {
      // New mode defaults — 09:00–10:00 today.
      const now = new Date();
      setStartDate(defaultStart(now));
      setEndDate(defaultEnd(now));
      setPauseDate(pauseMinutesToDate(0));
      setNote("");
      setEntrySource(null);
    }
  }, [entryId, entriesRepo]);

  // When New mode and places load, default placeId to the first place.
  useEffect(() => {
    if (!entryId && placeId == null && places.length > 0) {
      const first = places[0];
      if (first) setPlaceId(first.id);
    }
  }, [entryId, placeId, places]);

  const selectedPlace: Place | null = useMemo(() => {
    if (!placeId) return null;
    return places.find((p) => p.id === placeId) ?? null;
  }, [placeId, places]);

  const grossMin = useMemo(() => {
    // If end is before start the user is describing a cross-midnight
    // entry. We handle that on save (roll end +24h); for the live
    // preview we show 0 until end catches up.
    return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 60_000));
  }, [startDate, endDate]);

  const pauseMin = useMemo(() => pauseDateToMinutes(pauseDate), [pauseDate]);

  const netMin = Math.max(0, grossMin - pauseMin);

  const handleSave = useCallback(() => {
    if (!placeId) return; // no place selected — shouldn't happen post-load.

    const startedAt = Math.floor(startDate.getTime() / 1000);
    let endedAt = Math.floor(endDate.getTime() / 1000);
    // If end < start the user is describing an entry that crosses midnight.
    // Roll the end-date forward one day so the resulting entry still has
    // positive duration.
    if (endedAt < startedAt) endedAt += 86_400;
    const pauseS = pauseMin * 60;

    const commit = (opts?: { replace?: Entry[] }) => {
      if (opts?.replace) {
        for (const r of opts.replace) {
          entriesRepo.softDelete(r.id);
        }
      }
      if (isNew) {
        entriesRepo.createManual({
          placeId,
          startedAt,
          endedAt,
          note: note || undefined,
          pauseS,
        });
      } else if (entryId) {
        entriesRepo.update(entryId, {
          placeId,
          startedAt,
          endedAt,
          note: note || null,
          pauseS,
        });
      }
      bumpEntries();
      onClose();
    };

    // Check for overlapping entries. For a brand-new entry this is
    // purely additive; for an edit we exclude the row under edit so the
    // "overlap with itself" trivially isn't flagged.
    const overlaps = entriesRepo.findOverlapping(startedAt, endedAt, entryId ?? undefined);
    if (overlaps.length > 0) {
      Alert.alert(
        i18n.t("entryEdit.overlap.title"),
        i18n.t("entryEdit.overlap.body", { count: overlaps.length }),
        [
          { text: i18n.t("common.cancel"), style: "cancel" },
          {
            text: i18n.t("entryEdit.overlap.keepBoth"),
            onPress: () => commit(),
          },
          {
            text: i18n.t("entryEdit.overlap.replace"),
            style: "destructive",
            onPress: () => commit({ replace: overlaps }),
          },
        ],
      );
      return;
    }
    commit();
  }, [
    placeId,
    isNew,
    entryId,
    startDate,
    endDate,
    pauseMin,
    note,
    entriesRepo,
    bumpEntries,
    onClose,
  ]);

  const handleDelete = useCallback(() => {
    if (!entryId) return;
    entriesRepo.softDelete(entryId);
    bumpEntries();
    // Offer a 5s Undo via the global snackbar. Tapping Undo clears the
    // `deletedAt` mark so the entry reappears in Timeline/Stats. If the TTL
    // elapses first the deletion becomes durable (retention purge eventually
    // hard-removes it server-side of the clock, not eagerly).
    useSnackbarStore.getState().show({
      message: i18n.t("entryEdit.snack.deleted"),
      action: {
        label: i18n.t("entryEdit.snack.undo"),
        onPress: () => {
          try {
            entriesRepo.restore(entryId);
            bumpEntries();
          } catch {
            // Row was hard-purged between delete and undo — nothing we can
            // do; the snack host will dismiss regardless.
          }
        },
      },
      ttlMs: 5000,
    });
    onClose();
  }, [entryId, entriesRepo, bumpEntries, onClose]);

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
      {/* Net-duration readout — big centered display. */}
      <View style={{ alignItems: "center", marginBottom: t.space[5] }}>
        <Text
          style={{
            fontSize: t.type.size.xs,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.bold,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {i18n.t("entryEdit.label.netDuration")}
        </Text>
        <Text
          testID="entry-edit-net"
          style={{
            fontSize: 44,
            fontWeight: t.type.weight.bold,
            letterSpacing: -1,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            fontVariant: ["tabular-nums"],
            marginTop: 2,
          }}
        >
          {formatDurationCompact(netMin * 60)}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            fontVariant: ["tabular-nums"],
            marginTop: t.space[1],
          }}
        >
          {i18n.t("entryEdit.label.grossAndBreak", {
            gross: formatDurationCompact(grossMin * 60),
            pause: pauseMin,
          })}
        </Text>
      </View>

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

      {/* Delete — only in Edit mode. Trivially thin (one Button), so inline. */}
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
