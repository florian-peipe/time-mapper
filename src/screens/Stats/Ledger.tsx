import React, { useMemo } from "react";
import { PixelRatio, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme, type Theme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
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

// Base column widths per the design-system mono-grid spec. Actual rendered
// widths scale with `PixelRatio.getFontScale()` so text doesn't clip at
// large Dynamic Type / Font Scale settings. Clamped on both ends so the
// spreadsheet stays legible even at extreme values.
type Col = {
  key: "place" | "start" | "pause" | "end" | "duration" | "note";
  label: string;
  letter: "A" | "B" | "C" | "D" | "E" | "F";
  baseWidth: number;
  align: "left" | "right";
};
const BASE_COLUMNS: readonly Col[] = [
  { key: "place", label: "PLACE", letter: "A", baseWidth: 108, align: "left" },
  { key: "start", label: "START", letter: "B", baseWidth: 64, align: "right" },
  { key: "pause", label: "PAUSE", letter: "C", baseWidth: 52, align: "right" },
  { key: "end", label: "END", letter: "D", baseWidth: 64, align: "right" },
  { key: "duration", label: "DURATION", letter: "E", baseWidth: 72, align: "right" },
  { key: "note", label: "NOTE", letter: "F", baseWidth: 180, align: "left" },
] as const;

// Clamp the effective font scale — stop growing columns past 1.5× so the
// spreadsheet doesn't dominate the Stats page on max-size settings.
const FONT_SCALE_CEIL = 1.5;

const BASE_GUTTER_W = 38; // `#` row-number gutter column
const BASE_CELL_PAD_V = 10;
const BASE_CELL_PAD_H = 10;
const BASE_LETTER_PAD_V = 6;

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

  // Effective mono-grid metrics that scale with the user's font-size
  // preference. Computed on every render — cheap, and font scale only
  // changes via a system settings round-trip which re-mounts the screen
  // anyway. PixelRatio is SDK-wide and always returns ≥1.
  const { columns, gutterW, cellPadV, cellPadH, letterPadV } = useMemo(() => {
    const rawScale = PixelRatio.getFontScale();
    const scale = Math.min(Math.max(rawScale, 1), FONT_SCALE_CEIL);
    return {
      columns: BASE_COLUMNS.map((c) => ({ ...c, width: Math.round(c.baseWidth * scale) })),
      gutterW: Math.round(BASE_GUTTER_W * scale),
      cellPadV: Math.round(BASE_CELL_PAD_V * scale),
      cellPadH: Math.round(BASE_CELL_PAD_H * scale),
      letterPadV: Math.round(BASE_LETTER_PAD_V * scale),
    };
  }, []);

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

  const totalW = columns.reduce((a, c) => a + c.width, 0) + gutterW;

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
            {i18n.t("stats.ledger.title")}
          </Text>
          <Text
            style={{
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              marginTop: 2,
            }}
          >
            {i18n.t("stats.ledger.hint")}
          </Text>
        </View>
        <Pressable
          testID="ledger-add-row"
          onPress={onAddRow}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("stats.ledger.addRow")}
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
            {i18n.t("stats.ledger.addRow")}
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
            <ColumnLetterHeader
              columns={columns}
              gutterW={gutterW}
              letterPadV={letterPadV}
              cellPadH={cellPadH}
            />
            <FieldNameHeader
              columns={columns}
              gutterW={gutterW}
              cellPadV={cellPadV}
              cellPadH={cellPadH}
            />
            {rows.map((row, idx) => (
              <LedgerBodyRow
                key={row.entry.id}
                row={row}
                index={idx}
                isLast={idx === rows.length - 1}
                onPress={() => onOpenEntry(row.entry.id)}
                columns={columns}
                gutterW={gutterW}
                cellPadV={cellPadV}
                cellPadH={cellPadH}
              />
            ))}
            {rows.length > 0 ? (
              <SumRow
                totalMinutes={totalMinutes}
                totalPauseMinutes={totalPauseMinutes}
                columns={columns}
                gutterW={gutterW}
                cellPadV={cellPadV}
                cellPadH={cellPadH}
              />
            ) : null}
          </View>
        </ScrollView>
        {/*
          v0.3 polish: when the ledger is empty, the user's screenshot showed
          just column headers floating above a blank bar — reads as broken.
          A single muted "No entries yet" row below the headers makes the
          zero state legible without breaking the mono grid.
        */}
        {rows.length === 0 ? (
          <View
            testID="ledger-empty"
            style={{
              paddingVertical: t.space[6],
              alignItems: "center",
              borderTopWidth: 1,
              borderTopColor: t.color("color.border"),
            }}
          >
            <Text
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg3"),
                fontFamily: t.type.family.sans,
              }}
            >
              {i18n.t("stats.empty.noRows")}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type MetricsProps = {
  columns: (Col & { width: number })[];
  gutterW: number;
  cellPadV?: number;
  cellPadH: number;
  letterPadV?: number;
};

function ColumnLetterHeader({ columns, gutterW, letterPadV, cellPadH }: MetricsProps) {
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
      <View style={gutterHeaderStyle(t, gutterW, letterPadV ?? BASE_LETTER_PAD_V)}>
        <Text style={gutterLetterTextStyle(t)}>#</Text>
      </View>
      {columns.map((c, i) => (
        <View
          key={c.key}
          style={{
            width: c.width,
            paddingVertical: letterPadV ?? BASE_LETTER_PAD_V,
            paddingHorizontal: cellPadH,
            borderRightWidth: i === columns.length - 1 ? 0 : 1,
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

function FieldNameHeader({ columns, gutterW, cellPadH, letterPadV }: MetricsProps) {
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
      <View style={gutterHeaderStyle(t, gutterW, letterPadV ?? BASE_LETTER_PAD_V)} />
      {columns.map((c, i) => (
        <View
          key={c.key}
          style={{
            width: c.width,
            paddingVertical: t.space[2],
            paddingHorizontal: cellPadH,
            borderRightWidth: i === columns.length - 1 ? 0 : 1,
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
  columns,
  gutterW,
  cellPadV,
  cellPadH,
}: {
  row: LedgerRow;
  index: number;
  isLast: boolean;
  onPress: () => void;
  columns: (Col & { width: number })[];
  gutterW: number;
  cellPadV: number;
  cellPadH: number;
}) {
  const t = useTheme();
  const entry = row.entry;
  const place = row.place;

  const startLabel = formatClock(entry.startedAt);
  const endLabel = entry.endedAt == null ? i18n.t("entryRow.ongoing") : formatClock(entry.endedAt);
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
      <View
        style={[gutterBodyStyle(t, gutterW, cellPadV), { backgroundColor: t.color("color.surface2") }]}
      >
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
          width: columns[0]!.width,
          paddingVertical: cellPadV,
          paddingHorizontal: cellPadH,
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
      <NumericCell
        width={columns[1]!.width}
        value={startLabel}
        cellPadV={cellPadV}
        cellPadH={cellPadH}
      />
      <NumericCell
        width={columns[2]!.width}
        value={pauseLabel}
        color={pauseMinutes > 0 ? undefined : t.color("color.fg3")}
        cellPadV={cellPadV}
        cellPadH={cellPadH}
      />
      <NumericCell
        width={columns[3]!.width}
        value={endLabel}
        cellPadV={cellPadV}
        cellPadH={cellPadH}
      />
      <NumericCell
        width={columns[4]!.width}
        value={netLabel}
        bold
        cellPadV={cellPadV}
        cellPadH={cellPadH}
      />
      <View
        style={{
          width: columns[5]!.width,
          paddingVertical: cellPadH,
          paddingHorizontal: cellPadH,
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
  columns,
  gutterW,
  cellPadV,
  cellPadH,
}: {
  totalMinutes: number;
  totalPauseMinutes: number;
  columns: (Col & { width: number })[];
  gutterW: number;
  cellPadV: number;
  cellPadH: number;
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
      <View
        style={[gutterBodyStyle(t, gutterW, cellPadV), { backgroundColor: t.color("color.surface2") }]}
      >
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
          width: columns[0]!.width,
          paddingVertical: cellPadH,
          paddingHorizontal: cellPadH,
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
      <NumericCell width={columns[1]!.width} value="" cellPadV={cellPadV} cellPadH={cellPadH} />
      <NumericCell
        width={columns[2]!.width}
        value={pauseLabel}
        color={totalPauseMinutes > 0 ? undefined : t.color("color.fg3")}
        testID="ledger-sum-pause"
        cellPadV={cellPadV}
        cellPadH={cellPadH}
      />
      <NumericCell width={columns[3]!.width} value="" cellPadV={cellPadV} cellPadH={cellPadH} />
      <NumericCell
        width={columns[4]!.width}
        value={netLabel}
        bold
        testID="ledger-sum-duration"
        cellPadV={cellPadV}
        cellPadH={cellPadH}
      />
      <View
        style={{
          width: columns[5]!.width,
          paddingVertical: cellPadH,
          paddingHorizontal: cellPadH,
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
  cellPadV,
  cellPadH,
}: {
  width: number;
  value: string;
  bold?: boolean;
  color?: string;
  testID?: string;
  cellPadV: number;
  cellPadH: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width,
        paddingVertical: cellPadV,
        paddingHorizontal: cellPadH,
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

function gutterHeaderStyle(t: Theme, gutterW: number, letterPadV: number) {
  return {
    width: gutterW,
    paddingVertical: letterPadV,
    borderRightWidth: 1,
    borderRightColor: t.color("color.border"),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

function gutterBodyStyle(t: Theme, gutterW: number, cellPadV: number) {
  return {
    width: gutterW,
    paddingVertical: cellPadV,
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
