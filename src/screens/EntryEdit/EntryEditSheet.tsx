import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "@/theme/useTheme";
import {
  Button,
  Chip,
  Icon,
  Input,
  PlaceBubble,
  Sheet,
  TextArea,
  type IconName,
} from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { useEntriesRepo } from "@/features/entries/useEntries";
import { i18n } from "@/lib/i18n";
import { formatDurationCompact } from "@/lib/time";
import { useSnackbarStore } from "@/state/snackbarStore";
import { useDataVersionStore } from "@/state/dataVersionStore";
import type { Entry, Place } from "@/db/schema";

export type EntryEditSheetProps = {
  visible: boolean;
  /** null → "New entry" mode. Otherwise hydrate from the stored entry. */
  entryId: string | null;
  onClose: () => void;
};

const PAUSE_MAX_MIN = 720;
/** Default start — 09:00 local on the anchor date. */
function defaultStart(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(9, 0, 0, 0);
  return d;
}
/** Default end — 10:00 local on the anchor date. */
function defaultEnd(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(10, 0, 0, 0);
  return d;
}

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
  const [pause, setPause] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [entrySource, setEntrySource] = useState<"auto" | "manual" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
        setPause(String(Math.round((e.pauseS ?? 0) / 60)));
        setNote(e.note ?? "");
        setEntrySource(e.source);
      }
    } else {
      // New mode defaults — 09:00–10:00 today.
      const now = new Date();
      setStartDate(defaultStart(now));
      setEndDate(defaultEnd(now));
      setPause("0");
      setNote("");
      setEntrySource(null);
      setPickerOpen(false);
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

  const pauseMin = useMemo(() => {
    const n = parseInt(pause, 10);
    if (Number.isNaN(n)) return 0;
    return Math.min(Math.max(n, 0), PAUSE_MAX_MIN);
  }, [pause]);

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

  const handlePickPlace = useCallback((p: Place) => {
    setPlaceId(p.id);
    setPickerOpen(false);
  }, []);

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
            // design-source: padding 7/14, accent bg, pill, 13/600
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
            // design-source: 44px display, -1 letterSpacing
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

      {/* Place picker card — collapsed row expands to chip list. */}
      <View
        style={{
          backgroundColor: t.color("color.surface"),
          borderWidth: 1,
          borderColor: t.color("color.border"),
          borderRadius: t.radius.md,
          marginBottom: t.space[4],
          overflow: "hidden",
        }}
      >
        <Pressable
          testID="entry-edit-place-row"
          onPress={() => setPickerOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("entryEdit.label.selectPlace")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            // design-source: row padding 14/16
            paddingVertical: 14,
            paddingHorizontal: t.space[4],
            borderBottomWidth: pickerOpen ? 1 : 0,
            borderBottomColor: t.color("color.border"),
          }}
        >
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.medium,
              // design-source: label column fixed to 78px
              width: 78,
            }}
          >
            {i18n.t("entryEdit.label.place")}
          </Text>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: t.space[2] + 2, // design-source: gap 10
            }}
          >
            {selectedPlace ? (
              <>
                <PlaceBubble
                  icon={(selectedPlace.icon as IconName) ?? "map-pin"}
                  color={selectedPlace.color}
                  size={28}
                />
                <Text
                  style={{
                    fontSize: t.type.size.body,
                    fontWeight: t.type.weight.medium,
                    color: t.color("color.fg"),
                    fontFamily: t.type.family.sans,
                  }}
                >
                  {selectedPlace.name}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  fontSize: t.type.size.body,
                  color: t.color("color.fg3"),
                  fontFamily: t.type.family.sans,
                }}
              >
                {i18n.t("entryEdit.label.placeNone")}
              </Text>
            )}
          </View>
          <Icon name="chevron-right" size={16} color={t.color("color.fg3")} />
        </Pressable>
        {pickerOpen ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: t.space[2],
              padding: t.space[3] - 2, // design-source: padding 10
            }}
          >
            {places.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={p.id === placeId}
                onPress={() => handlePickPlace(p)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {/* Time + pause fields card. */}
      <View
        style={{
          backgroundColor: t.color("color.surface"),
          borderWidth: 1,
          borderColor: t.color("color.border"),
          borderRadius: t.radius.md,
          marginBottom: t.space[4],
          overflow: "hidden",
        }}
      >
        <PickerRow
          label={i18n.t("entryEdit.label.date")}
          testID="entry-edit-date"
          mode="date"
          value={startDate}
          maximumDate={new Date()}
          onChange={(d) => {
            // Keep the existing clock time — only change the date.
            const newStart = new Date(startDate);
            newStart.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            const newEnd = new Date(endDate);
            newEnd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            setStartDate(newStart);
            setEndDate(newEnd);
          }}
        />
        <PickerRow
          label={i18n.t("entryEdit.label.start")}
          testID="entry-edit-start"
          mode="time"
          value={startDate}
          onChange={setStartDate}
        />
        <PickerRow
          label={i18n.t("entryEdit.label.end")}
          testID="entry-edit-end"
          mode="time"
          value={endDate}
          onChange={setEndDate}
        />
        <FieldRow
          label={i18n.t("entryEdit.label.pause")}
          value={pause}
          onChangeText={(v) => setPause(v.replace(/[^0-9]/g, ""))}
          testID="entry-edit-pause"
          placeholder="0"
          keyboardType="number-pad"
          maxLength={3}
          mono
          suffix={i18n.t("entryEdit.label.minSuffix")}
          last
        />
      </View>

      {/* Note card. */}
      <View
        style={{
          backgroundColor: t.color("color.surface"),
          borderWidth: 1,
          borderColor: t.color("color.border"),
          borderRadius: t.radius.md,
          marginBottom: t.space[4],
          paddingVertical: 14, // design-source: note card padding 14/16
          paddingHorizontal: t.space[4],
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
            marginBottom: t.space[1] + 2, // design-source: marginBottom 6
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {i18n.t("entryEdit.label.note")}
        </Text>
        <TextArea
          testID="entry-edit-note"
          value={note}
          onChangeText={setNote}
          placeholder={i18n.t("entryEdit.label.notePlaceholder")}
          style={{
            borderWidth: 0,
            paddingHorizontal: 0,
            paddingVertical: 0,
            backgroundColor: "transparent",
            minHeight: 60,
          }}
        />
      </View>

      {/* Source chip — centered neutral pill when an entry source exists. */}
      {entrySource ? (
        <View style={{ alignItems: "center", marginBottom: t.space[3] }}>
          <View
            style={{
              // design-source: 4/10 padding, pill, border, surface2 bg.
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
          <Button variant="destructive" size="md" full onPress={handleDelete}>
            {i18n.t("entryEdit.label.delete")}
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * Row that hosts a native `DateTimePicker` inline — `display="compact"`
 * on iOS renders a tappable chip with the current value that opens the
 * native wheel picker in a popover when pressed; Android shows the
 * value as text and opens the system picker dialog on tap. Either way
 * the user never sees a keyboard or a custom parser — the OS controls
 * time entry.
 */
function PickerRow({
  label,
  value,
  mode,
  onChange,
  maximumDate,
  testID,
}: {
  label: string;
  value: Date;
  mode: "date" | "time";
  onChange: (d: Date) => void;
  maximumDate?: Date;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: t.space[4],
        borderBottomWidth: 1,
        borderBottomColor: t.color("color.border"),
        minHeight: t.minTouchTarget,
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.s,
          color: t.color("color.fg3"),
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.medium,
          width: 78,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <DateTimePicker
          testID={testID}
          mode={mode}
          display={Platform.OS === "ios" ? "compact" : "default"}
          value={value}
          maximumDate={maximumDate}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            // Android's picker fires once and dismisses; iOS fires on
            // every scroll of the wheel. Only commit when a value came
            // through — `type` is `"set"` on both platforms when the
            // user has chosen a value (vs `"dismissed"` for cancel).
            if (event.type === "set" && selected) {
              onChange(selected);
            }
          }}
        />
      </View>
    </View>
  );
}

/** Re-used row inside the times card. */
function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  suffix,
  error,
  testID,
  last,
  mono,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "numbers-and-punctuation" | "number-pad";
  maxLength?: number;
  suffix?: string;
  error?: string;
  testID?: string;
  last?: boolean;
  mono?: boolean;
}) {
  const t = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          // design-source: row padding 14/16
          paddingVertical: 14,
          paddingHorizontal: t.space[4],
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: t.color("color.border"),
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
            width: 78, // design-source: label column 78
          }}
        >
          {label}
        </Text>
        <Input
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          accessibilityLabel={label}
          // Match the spreadsheet-like inline input — transparent, right-aligned,
          // mono where tabular numbers matter.
          style={{
            flex: 1,
            height: 28,
            borderWidth: 0,
            backgroundColor: "transparent",
            paddingHorizontal: 0,
            textAlign: "right",
            fontFamily: mono ? t.type.family.mono : t.type.family.sans,
            fontSize: t.type.size.m,
            color: t.color("color.fg"),
          }}
        />
        {suffix ? (
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              // design-source: 6 left margin on the "min" suffix
              marginLeft: 6,
            }}
          >
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <View style={{ paddingHorizontal: t.space[4], paddingBottom: t.space[2] }}>
          <Text
            style={{
              color: t.color("color.danger"),
              fontSize: t.type.size.xs,
              fontFamily: t.type.family.sans,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
