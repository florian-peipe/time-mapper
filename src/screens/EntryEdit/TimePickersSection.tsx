import React from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";

export type TimePickersSectionProps = {
  startDate: Date;
  endDate: Date;
  pauseDate: Date;
  onStartDateChange: (d: Date) => void;
  onEndDateChange: (d: Date) => void;
  onPauseDateChange: (d: Date) => void;
};

export function TimePickersSection({
  startDate,
  endDate,
  pauseDate,
  onStartDateChange,
  onEndDateChange,
  onPauseDateChange,
}: TimePickersSectionProps) {
  const t = useTheme();
  return (
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
          onStartDateChange(newStart);
          onEndDateChange(newEnd);
        }}
      />
      <PickerRow
        label={i18n.t("entryEdit.label.start")}
        testID="entry-edit-start"
        mode="time"
        value={startDate}
        onChange={onStartDateChange}
      />
      <PickerRow
        label={i18n.t("entryEdit.label.end")}
        testID="entry-edit-end"
        mode="time"
        value={endDate}
        onChange={onEndDateChange}
      />
      <PickerRow
        label={i18n.t("entryEdit.label.pause")}
        testID="entry-edit-pause"
        mode="time"
        value={pauseDate}
        onChange={onPauseDateChange}
      />
    </View>
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
