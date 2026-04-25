import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { PauseDurationStepper } from "./PauseDurationStepper";

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
      <PauseRow
        label={i18n.t("entryEdit.label.pause")}
        testID="entry-edit-pause"
        value={pauseDate}
        onChange={onPauseDateChange}
      />
    </View>
  );
}

function PauseRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
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
        <PauseDurationStepper testID={testID} value={value} onChange={onChange} />
      </View>
    </View>
  );
}

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

  // Android: mounting <DateTimePicker> immediately opens the system dialog.
  // Use the imperative API so the dialog only opens when the user taps the row.
  const handleAndroidPress = () => {
    DateTimePickerAndroid.open({
      value,
      mode,
      maximumDate,
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === "set" && selected) {
          onChange(selected);
        }
      },
    });
  };

  // Formatted display value for the Android tappable chip.
  const androidLabel =
    mode === "time"
      ? value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      : value.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });

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
        {Platform.OS === "android" ? (
          <Pressable
            testID={testID}
            onPress={handleAndroidPress}
            hitSlop={t.space[2]}
            accessibilityRole="button"
          >
            <Text
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.accent"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
              }}
            >
              {androidLabel}
            </Text>
          </Pressable>
        ) : (
          <DateTimePicker
            testID={testID}
            mode={mode}
            display="compact"
            value={value}
            maximumDate={maximumDate}
            onChange={(event: DateTimePickerEvent, selected?: Date) => {
              // iOS fires on every scroll of the wheel — only commit on "set".
              if (event.type === "set" && selected) {
                onChange(selected);
              }
            }}
          />
        )}
      </View>
    </View>
  );
}
