import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme, type Theme } from "@/theme/useTheme";
import { Icon } from "@/components";
import type { Entry, Place } from "@/db/schema";

type LedgerRow = {
  entry: Entry;
  place: Place;
};

type Props = {
  /** Entries inside the current week, latest first — typically `useWeekStats().entries`. */
  entries: Entry[];
  /** Lookup for decorating each row with place name + color. */
  placesById: Map<string, Place>;
  onOpenEntry: (entryId: string) => void;
  onAddRow: () => void;
  testID?: string;
};

// Column widths are the design-system spec for the mono-grid spreadsheet —
// they must match across the header, body, and sum rows exactly, so we keep
// them as literals with one place to edit.
const COLUMNS = [
  { key: "place", label: "PLACE", letter: "A", width: 108, align: "left" }, // column width, mono grid
  { key: "start", label: "START", letter: "B", width: 64, align: "right" }, // column width, mono grid
  { key: "pause", label: "PAUSE", letter: "C", width: 52, align: "right" }, // column width, mono grid
  { key: "end", label: "END", letter: "D", width: 64, align: "right" }, // column width, mono grid
  { key: "duration", label: "DURATION", letter: "E", width: 72, align: "right" }, // column width, mono grid
  { key: "note", label: "NOTE", letter: "F", width: 180, align: "left" }, // column width, mono grid
] as const;

// `#` row-number gutter column width — design-system 38px. No token fits;
// mono-grid alignment is the constraint.
const GUTTER_W = 38; // column width, mono grid
// Cell paddings that the design-system mono grid relies on — 6 for the
// letter-row header, 10 for everything else. No space tokens at those sizes.
const CELL_PAD_V = 10; // cell vertical padding, mono grid
const CELL_PAD_H = 10; // cell horizontal padding, mono grid
const LETTER_PAD_V = 6; // letter-row vertical padding, mono grid

/**
 * Spreadsheet-style ledger table used by the Stats screen. Source:
 * design-system Screens.jsx → Ledger. The two header rows (Excel letter
 * A/B/C/.. + field name) and the final Σ sum row are all mono-formatted.
 *
 * Numeric cells use `type.family.mono` for alignment — the only place in
 * the app that surfaces the mono family. Text cells (place name, note) fall
 * back to `type.family.sans` for readability.
 */
export function Ledger({ entries, placesById, onOpenEntry, onAddRow, testID }: Props) {
  const t = useTheme();

  const rows: LedgerRow[] = [];
  for (const entry of entries) {
    const place = placesById.get(entry.placeId);
    if (!place) continue;
    rows.push({ entry, place });
  }

  const totalMinutes = rows.reduce((sum, r) => sum + netMinutes(r.entry), 0);
  const totalPauseMinutes = rows.reduce(
    (sum, r) => sum + Math.floor((r.entry.pauseS ?? 0) / 60),
    0,
  );

  const totalW = COLUMNS.reduce((a, c) => a + c.width, 0) + GUTTER_W;

  return (
    <View
      testID={testID}
      style={{
        marginHorizontal: t.space[5],
        marginTop: t.space[3],
        marginBottom: t.space[5],
      }}
    >
      {/* Header strip: title on the left, "Add row" pill button on the right. */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingBottom: t.space[2],
        }}
      >
        <View>
          <Text
            style={{
              fontSize: t.type.size.m,
              fontWeight: t.type.weight.bold,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              letterSpacing: -0.3,
            }}
          >
            Ledger
          </Text>
          <Text
            style={{
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              marginTop: 2,
            }}
          >
            Tap any row to edit · swipe table to scroll
          </Text>
        </View>
        <Pressable
          testID="ledger-add-row"
          onPress={onAddRow}
          accessibilityRole="button"
          accessibilityLabel="Add row"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.space[1],
            paddingVertical: t.space[2],
            paddingHorizontal: t.space[3],
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.fg"),
          }}
        >
          <Icon name="plus" size={14} color={t.color("color.bg")} />
          <Text
            style={{
              color: t.color("color.bg"),
              fontSize: t.type.size.xs,
              fontWeight: t.type.weight.semibold,
              fontFamily: t.type.family.sans,
            }}
          >
            Add row
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          backgroundColor: t.color("color.surface"),
          borderWidth: 1,
          borderColor: t.color("color.border"),
          borderRadius: t.radius.md,
          overflow: "hidden",
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: totalW }}>
            <ColumnLetterHeader />
            <FieldNameHeader />
            {rows.map((row, idx) => (
              <LedgerBodyRow
                key={row.entry.id}
                row={row}
                index={idx}
                isLast={idx === rows.length - 1}
                onPress={() => onOpenEntry(row.entry.id)}
              />
            ))}
            {rows.length > 0 ? (
              <SumRow totalMinutes={totalMinutes} totalPauseMinutes={totalPauseMinutes} />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function ColumnLetterHeader() {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.color("color.surface2"),
        borderBottomWidth: 1,
        borderBottomColor: t.color("color.border"),
      }}
    >
      <View style={gutterHeaderStyle(t)}>
        <Text style={gutterLetterTextStyle(t)}>#</Text>
      </View>
      {COLUMNS.map((c, i) => (
        <View
          key={c.key}
          style={{
            width: c.width,
            paddingVertical: LETTER_PAD_V,
            paddingHorizontal: CELL_PAD_H,
            borderRightWidth: i === COLUMNS.length - 1 ? 0 : 1,
            borderRightColor: t.color("color.border"),
          }}
        >
          <Text
            testID={`ledger-col-letter-${c.letter}`}
            style={{
              textAlign: c.align,
              color: t.color("color.fg3"),
              fontSize: t.type.size.xs, // smallest token (11) — design-system used 10 but we keep ≥xs
              fontWeight: t.type.weight.semibold,
              fontFamily: t.type.family.mono,
            }}
          >
            {c.letter}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FieldNameHeader() {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.color("color.bg"),
        borderBottomWidth: 1,
        borderBottomColor: t.color("color.border"),
      }}
    >
      <View style={gutterHeaderStyle(t)} />
      {COLUMNS.map((c, i) => (
        <View
          key={c.key}
          style={{
            width: c.width,
            paddingVertical: t.space[2],
            paddingHorizontal: CELL_PAD_H,
            borderRightWidth: i === COLUMNS.length - 1 ? 0 : 1,
            borderRightColor: t.color("color.border"),
          }}
        >
          <Text
            style={{
              textAlign: c.align,
              color: t.color("color.fg2"),
              fontSize: t.type.size.xs,
              fontWeight: t.type.weight.bold,
              fontFamily: t.type.family.sans,
              letterSpacing: 0.4,
            }}
          >
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LedgerBodyRow({
  row,
  index,
  isLast,
  onPress,
}: {
  row: LedgerRow;
  index: number;
  isLast: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const entry = row.entry;
  const place = row.place;

  const startLabel = formatClock(entry.startedAt);
  const endLabel = entry.endedAt == null ? "now" : formatClock(entry.endedAt);
  const pauseMinutes = Math.floor((entry.pauseS ?? 0) / 60);
  const pauseLabel = pauseMinutes > 0 ? formatHoursMinutes(pauseMinutes) : "—";
  const netLabel = formatHoursMinutes(netMinutes(entry));

  return (
    <Pressable
      testID={`ledger-row-${index}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit entry ${place.name}`}
      style={{
        flexDirection: "row",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: t.color("color.border"),
      }}
    >
      <View style={[gutterBodyStyle(t), { backgroundColor: t.color("color.surface2") }]}>
        <Text
          style={{
            color: t.color("color.fg3"),
            fontSize: t.type.size.xs,
            fontWeight: t.type.weight.semibold,
            fontFamily: t.type.family.mono,
            textAlign: "center",
            fontVariant: ["tabular-nums"],
          }}
        >
          {index + 1}
        </Text>
      </View>
      <View
        style={{
          width: COLUMNS[0].width,
          paddingVertical: CELL_PAD_V,
          paddingHorizontal: CELL_PAD_H,
          borderRightWidth: 1,
          borderRightColor: t.color("color.border"),
          flexDirection: "row",
          alignItems: "center",
          gap: t.space[2],
        }}
      >
        <View
          style={{
            width: 8, // color swatch, design-system 8
            height: 8,
            borderRadius: t.radius.sm,
            backgroundColor: place.color,
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: t.type.size.s,
            fontWeight: t.type.weight.medium,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
          }}
        >
          {place.name}
        </Text>
      </View>
      <NumericCell width={COLUMNS[1].width} value={startLabel} />
      <NumericCell
        width={COLUMNS[2].width}
        value={pauseLabel}
        color={pauseMinutes > 0 ? undefined : t.color("color.fg3")}
      />
      <NumericCell width={COLUMNS[3].width} value={endLabel} />
      <NumericCell width={COLUMNS[4].width} value={netLabel} bold />
      <View
        style={{
          width: COLUMNS[5].width,
          paddingVertical: CELL_PAD_H,
          paddingHorizontal: CELL_PAD_H,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: t.type.size.s,
            fontFamily: t.type.family.sans,
            color: entry.note ? t.color("color.fg2") : t.color("color.fg3"),
            fontStyle: entry.note ? "normal" : "italic",
          }}
        >
          {entry.note || "—"}
        </Text>
      </View>
    </Pressable>
  );
}

function SumRow({
  totalMinutes,
  totalPauseMinutes,
}: {
  totalMinutes: number;
  totalPauseMinutes: number;
}) {
  const t = useTheme();
  const netLabel = formatHoursMinutes(totalMinutes);
  const pauseLabel = totalPauseMinutes > 0 ? formatHoursMinutes(totalPauseMinutes) : "—";
  return (
    <View
      testID="ledger-sum-row"
      style={{
        flexDirection: "row",
        backgroundColor: t.color("color.bg"),
        borderTopWidth: 2, // design-system borderTop: 2px borderStrong
        borderTopColor: t.color("color.border.strong"),
      }}
    >
      <View style={[gutterBodyStyle(t), { backgroundColor: t.color("color.surface2") }]}>
        <Text
          style={{
            color: t.color("color.fg3"),
            fontSize: t.type.size.xs,
            fontWeight: t.type.weight.bold,
            fontFamily: t.type.family.mono,
            textAlign: "center",
          }}
        >
          Σ
        </Text>
      </View>
      <View
        style={{
          width: COLUMNS[0].width,
          paddingVertical: CELL_PAD_H,
          paddingHorizontal: CELL_PAD_H,
          borderRightWidth: 1,
          borderRightColor: t.color("color.border"),
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.xs,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
            letterSpacing: 0.4,
          }}
        >
          TOTAL
        </Text>
      </View>
      <NumericCell width={COLUMNS[1].width} value="" />
      <NumericCell
        width={COLUMNS[2].width}
        value={pauseLabel}
        color={totalPauseMinutes > 0 ? undefined : t.color("color.fg3")}
        testID="ledger-sum-pause"
      />
      <NumericCell width={COLUMNS[3].width} value="" />
      <NumericCell width={COLUMNS[4].width} value={netLabel} bold testID="ledger-sum-duration" />
      <View
        style={{
          width: COLUMNS[5].width,
          paddingVertical: CELL_PAD_H,
          paddingHorizontal: CELL_PAD_H,
        }}
      />
    </View>
  );
}

function NumericCell({
  width,
  value,
  bold,
  color,
  testID,
}: {
  width: number;
  value: string;
  bold?: boolean;
  color?: string;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width,
        paddingVertical: CELL_PAD_V,
        paddingHorizontal: CELL_PAD_H,
        borderRightWidth: 1,
        borderRightColor: t.color("color.border"),
      }}
    >
      <Text
        testID={testID}
        style={{
          textAlign: "right",
          fontSize: t.type.size.s,
          color: color ?? t.color("color.fg"),
          fontFamily: t.type.family.mono,
          fontVariant: ["tabular-nums"],
          fontWeight: bold ? t.type.weight.semibold : t.type.weight.regular,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function gutterHeaderStyle(t: Theme) {
  return {
    width: GUTTER_W,
    paddingVertical: LETTER_PAD_V,
    borderRightWidth: 1,
    borderRightColor: t.color("color.border"),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

function gutterBodyStyle(t: Theme) {
  return {
    width: GUTTER_W,
    paddingVertical: CELL_PAD_V,
    borderRightWidth: 1,
    borderRightColor: t.color("color.border"),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

function gutterLetterTextStyle(t: Theme) {
  return {
    color: t.color("color.fg3"),
    fontSize: t.type.size.xs,
    fontWeight: t.type.weight.semibold,
    fontFamily: t.type.family.mono,
    textAlign: "center" as const,
  };
}

function formatClock(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function netMinutes(entry: Entry): number {
  if (entry.endedAt == null) return 0;
  const seconds = entry.endedAt - entry.startedAt - (entry.pauseS ?? 0);
  if (seconds <= 0) return 0;
  return Math.round(seconds / 60);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
