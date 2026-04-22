import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Toggle } from "@/components";
import { i18n } from "@/lib/i18n";
import { HourRow } from "./HourRow";
import { isQuietRangeInvalid } from "./notificationsUtils";

/**
 * Quiet-hours editor: a toggle plus two hour-precision start/end steppers.
 * Purely presentational — state + setters are owned by the parent sheet so
 * the orchestrator can persist everything atomically on Save.
 */
export function QuietHoursSection({
  enabled,
  startH,
  endH,
  onToggle,
  onChangeStart,
  onChangeEnd,
}: {
  enabled: boolean;
  startH: number;
  endH: number;
  onToggle: () => void;
  onChangeStart: (v: number) => void;
  onChangeEnd: (v: number) => void;
}) {
  const t = useTheme();
  const rangeInvalid = isQuietRangeInvalid(enabled, startH, endH);

  return (
    <>
      <Pressable
        testID="notifications-toggle"
        accessibilityRole="switch"
        accessibilityLabel={i18n.t("settings.notifications.quietToggle")}
        accessibilityState={{ checked: enabled }}
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: t.space[3],
          paddingHorizontal: t.space[4],
          borderWidth: 1,
          borderColor: t.color("color.border"),
          borderRadius: t.radius.md,
          marginBottom: t.space[4],
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.body,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
          }}
        >
          {i18n.t("settings.notifications.quietToggle")}
        </Text>
        <Toggle checked={enabled} />
      </Pressable>

      {/* Start + end hour steppers — disabled when quiet hours are off. */}
      <HourRow
        label={i18n.t("settings.notifications.start")}
        hour={startH}
        onChange={onChangeStart}
        disabled={!enabled}
        testID="notifications-start"
      />
      <View style={{ height: t.space[3] }} />
      <HourRow
        label={i18n.t("settings.notifications.end")}
        hour={endH}
        onChange={onChangeEnd}
        disabled={!enabled}
        testID="notifications-end"
      />

      {rangeInvalid ? (
        <Text
          testID="notifications-error"
          style={{
            fontSize: t.type.size.xs,
            color: t.color("color.danger"),
            fontFamily: t.type.family.sans,
            marginTop: t.space[3],
          }}
        >
          {i18n.t("settings.notifications.rangeInvalid")}
        </Text>
      ) : null}
    </>
  );
}
