import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
import type { Entry, Place } from "@/db/schema";

export type EntryEditSheetProps = {
  visible: boolean;
  /** null → "New entry" mode. Otherwise hydrate from the stored entry. */
  entryId: string | null;
  onClose: () => void;
};

/** Matches HH:MM (1- or 2-digit hours, 2-digit minutes). */
const TIME_RE = /^\d{1,2}:\d{2}$/;
const PAUSE_MAX_MIN = 720;
const DEFAULT_START = "09:00";
const DEFAULT_END = "10:00";

/**
 * EntryEditSheet — manual add/edit flow. Source: Screens.jsx EntryEditSheet
 * (lines 515-654). Ports the full form: net-duration readout, place picker
 * (collapsed row + chip list), HH:MM time fields, pause minutes, note
 * textarea, optional source chip, and a destructive delete button in Edit
 * mode.
 *
 * Design-source notable numeric constants (kept as literals with inline
 * justification, not invented tokens):
 *   - heightPercent 86 (sheet height)
 *   - 44px display for the net-duration readout
 *   - pause input cap at 720 minutes
 */
export function EntryEditSheet({ visible, entryId, onClose }: EntryEditSheetProps) {
  const t = useTheme();
  const { places } = usePlaces();
  const entriesRepo = useEntriesRepo();

  const isNew = entryId == null;

  // Hydrate form state. Effects below rebuild state when entryId changes or
  // when places load (for the New-mode default place).
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [start, setStart] = useState<string>(DEFAULT_START);
  const [end, setEnd] = useState<string>(DEFAULT_END);
  const [pause, setPause] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [entrySource, setEntrySource] = useState<"auto" | "manual" | null>(null);
  const [startError, setStartError] = useState<string | undefined>();
  const [endError, setEndError] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Anchor timestamp for HH:MM → unix conversion. In edit mode this is the
  // entry's original `startedAt` so we preserve the original date when the
  // user only tweaks the clock time. In new mode it's "now".
  const [anchorS, setAnchorS] = useState<number>(() => Math.floor(Date.now() / 1000));

  // Hydrate from the selected entry (Edit mode) or apply defaults (New mode).
  useEffect(() => {
    if (entryId) {
      const e: Entry | null = entriesRepo.get(entryId);
      if (e) {
        setPlaceId(e.placeId);
        setStart(secondsToHHMM(e.startedAt));
        setEnd(e.endedAt != null ? secondsToHHMM(e.endedAt) : DEFAULT_END);
        setPause(String(Math.round((e.pauseS ?? 0) / 60)));
        setNote(e.note ?? "");
        setEntrySource(e.source);
        setAnchorS(e.startedAt);
      }
    } else {
      // New mode defaults.
      setStart(DEFAULT_START);
      setEnd(DEFAULT_END);
      setPause("0");
      setNote("");
      setEntrySource(null);
      setPickerOpen(false);
      setAnchorS(Math.floor(Date.now() / 1000));
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
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return 0;
    return Math.max(0, toMinutes(end) - toMinutes(start));
  }, [start, end]);

  const pauseMin = useMemo(() => {
    const n = parseInt(pause, 10);
    if (Number.isNaN(n)) return 0;
    return Math.min(Math.max(n, 0), PAUSE_MAX_MIN);
  }, [pause]);

  const netMin = Math.max(0, grossMin - pauseMin);

  const runValidation = useCallback((): boolean => {
    let ok = true;
    if (!TIME_RE.test(start)) {
      setStartError(i18n.t("entryEdit.error.hhmm"));
      ok = false;
    } else {
      setStartError(undefined);
    }
    if (!TIME_RE.test(end)) {
      setEndError(i18n.t("entryEdit.error.hhmm"));
      ok = false;
    } else {
      setEndError(undefined);
    }
    return ok;
  }, [start, end]);

  const handleSave = useCallback(() => {
    if (!runValidation()) return;
    if (!placeId) return; // no place selected — shouldn't happen post-load.

    const startedAt = hhmmToUnixSecondsAt(start, anchorS);
    let endedAt = hhmmToUnixSecondsAt(end, anchorS);
    // If end < start the user is describing an entry that crosses midnight.
    // Roll the end-date forward one day so the resulting entry still has
    // positive duration.
    if (endedAt < startedAt) endedAt += 86_400;
    const pauseS = pauseMin * 60;

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
    onClose();
  }, [
    runValidation,
    placeId,
    isNew,
    entryId,
    start,
    end,
    pauseMin,
    note,
    entriesRepo,
    onClose,
    anchorS,
  ]);

  const handleDelete = useCallback(() => {
    if (!entryId) return;
    entriesRepo.softDelete(entryId);
    onClose();
  }, [entryId, entriesRepo, onClose]);

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
          {formatDur(netMin)}
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
            gross: formatDur(grossMin),
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
        <FieldRow
          label={i18n.t("entryEdit.label.start")}
          value={start}
          onChangeText={(v) => {
            setStart(v);
            if (startError) setStartError(undefined);
          }}
          testID="entry-edit-start"
          error={startError}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
          mono
        />
        <FieldRow
          label={i18n.t("entryEdit.label.end")}
          value={end}
          onChangeText={(v) => {
            setEnd(v);
            if (endError) setEndError(undefined);
          }}
          testID="entry-edit-end"
          error={endError}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
          mono
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

/** `"09:15" → 9*60 + 15`. Caller guarantees the input matches TIME_RE. */
function toMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

/** `1h 05m` style duration from a minute count (non-negative). */
function formatDur(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/**
 * Convert a local HH:MM clock reading to unix seconds, anchored to the
 * local-calendar day of `anchorUnixSeconds`. Critical for edit mode: if the
 * user edits yesterday's entry and only changes the clock, we keep
 * "yesterday" fixed instead of snapping to today. Exported for unit tests.
 *
 * Caller guarantees the HH:MM string matches `TIME_RE`.
 */
export function hhmmToUnixSecondsAt(hhmm: string, anchorUnixSeconds: number): number {
  const parts = hhmm.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const d = new Date(anchorUnixSeconds * 1000);
  d.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/** Local-time `HH:MM` from a unix-seconds timestamp. */
function secondsToHHMM(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
