import React from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Toggle } from "@/components";
import { i18n } from "@/lib/i18n";
import { HourRow } from "./HourRow";

/**
 * Daily-digest schedule editor: header, enable toggle, and an hour picker.
 * Independent of quiet hours — either section can be toggled on its own.
 * Presentational only: the parent sheet owns state and persists on Save.
 */
export function DigestSection({
  enabled,
  hour,
  onToggle,
  onChangeHour,
}: {
  enabled: boolean;
  hour: number;
  onToggle: () => void;
  onChangeHour: (v: number) => void;
}) {
  const t = useTheme();

  return (
    <>
      <Text
        style={{
          fontSize: t.type.size.xs,
          color: t.color("color.fg3"),
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.bold,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginTop: t.space[6],
          marginBottom: t.space[3],
        }}
      >
        {i18n.t("settings.notifications.digest.header")}
      </Text>
      <Pressable
        testID="notifications-digest-toggle"
        accessibilityRole="switch"
        accessibilityLabel={i18n.t("settings.notifications.digest.toggle")}
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
          {i18n.t("settings.notifications.digest.toggle")}
        </Text>
        <Toggle checked={enabled} />
      </Pressable>
      <HourRow
        label={i18n.t("settings.notifications.digest.hour")}
        hour={hour}
        onChange={onChangeHour}
        disabled={!enabled}
        testID="notifications-digest-hour"
      />
    </>
  );
}
