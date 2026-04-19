import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Sheet } from "@/components";
import { useKvRepo } from "@/features/onboarding/useOnboardingGate";
import { getQuietHours, setQuietHours, type QuietHours } from "@/features/notifications/notifier";
import { i18n } from "@/lib/i18n";

export type NotificationsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const DEFAULT_QUIET_START_H = 22;
const DEFAULT_QUIET_END_H = 7;

/**
 * Lightweight "quiet hours" editor. The notifier backend already honors
 * `notifier.quiet_hours`; this exposes a simple UI: a toggle plus two
 * hour-precision start/end selectors.
 *
 * Design decision: hour-only (not HH:MM). `QuietHours` in notifier.ts is
 * declared as `{ startH, endH }` with hour-granularity — a rare instance
 * where the backend wants coarser data than the UI normally provides. We
 * surface hour-stepper cells instead of inviting a full time picker that
 * would be truncated on save.
 */
export function NotificationsSheet({ visible, onClose }: NotificationsSheetProps) {
  const t = useTheme();
  const kv = useKvRepo();

  const [enabled, setEnabled] = useState(false);
  const [startH, setStartH] = useState(DEFAULT_QUIET_START_H);
  const [endH, setEndH] = useState(DEFAULT_QUIET_END_H);

  useEffect(() => {
    if (!visible) return;
    const q = getQuietHours(kv);
    if (q) {
      setEnabled(true);
      setStartH(q.startH);
      setEndH(q.endH);
    } else {
      setEnabled(false);
      setStartH(DEFAULT_QUIET_START_H);
      setEndH(DEFAULT_QUIET_END_H);
    }
  }, [visible, kv]);

  const handleSave = useCallback(() => {
    if (!enabled) {
      setQuietHours(kv, null);
      onClose();
      return;
    }
    if (startH === endH) {
      // Backend treats zero-length windows as "never quiet". We refuse to
      // save and let the user adjust. Fail via surface feedback rather than
      // silently clearing the setting.
      return;
    }
    const q: QuietHours = { startH, endH };
    setQuietHours(kv, q);
    onClose();
  }, [enabled, startH, endH, kv, onClose]);

  const rangeInvalid = enabled && startH === endH;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={70}
      title={i18n.t("settings.notifications.title")}
      testID="notifications-sheet"
      footer={
        <Button
          variant="primary"
          size="md"
          full
          onPress={handleSave}
          disabled={rangeInvalid}
          testID="notifications-sheet-save"
        >
          {i18n.t("common.save")}
        </Button>
      }
    >
      <Text
        style={{
          fontSize: t.type.size.s,
          color: t.color("color.fg2"),
          fontFamily: t.type.family.sans,
          marginBottom: t.space[5],
        }}
      >
        {i18n.t("settings.notifications.body")}
      </Text>

      {/* Enable toggle */}
      <Pressable
        testID="notifications-toggle"
        accessibilityRole="switch"
        accessibilityLabel={i18n.t("settings.notifications.quietToggle")}
        accessibilityState={{ checked: enabled }}
        onPress={() => setEnabled((v) => !v)}
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
        <View
          style={{
            width: 44,
            height: 26,
            borderRadius: t.radius.pill,
            backgroundColor: enabled ? t.color("color.accent") : t.color("color.border.strong"),
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: t.radius.pill,
              backgroundColor: t.color("color.accent.contrast"),
              alignSelf: enabled ? "flex-end" : "flex-start",
            }}
          />
        </View>
      </Pressable>

      {/* Start + end hour steppers — disabled when quiet hours are off. */}
      <HourRow
        label={i18n.t("settings.notifications.start")}
        hour={startH}
        onChange={setStartH}
        disabled={!enabled}
        testID="notifications-start"
      />
      <View style={{ height: t.space[3] }} />
      <HourRow
        label={i18n.t("settings.notifications.end")}
        hour={endH}
        onChange={setEndH}
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
    </Sheet>
  );
}

function HourRow({
  label,
  hour,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  hour: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const step = (delta: number) => {
    const next = (((hour + delta) % 24) + 24) % 24;
    onChange(next);
  };
  const hhmm = `${String(hour).padStart(2, "0")}:00`;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: t.space[3],
        paddingHorizontal: t.space[4],
        borderWidth: 1,
        borderColor: t.color("color.border"),
        borderRadius: t.radius.md,
        opacity: disabled ? 0.4 : 1,
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
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.space[2] }}>
        <Pressable
          testID={testID ? `${testID}-dec` : undefined}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("settings.notifications.decrement")}
          disabled={disabled}
          onPress={() => step(-1)}
          style={{
            width: t.minTouchTarget,
            height: t.minTouchTarget,
            borderRadius: t.radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.color("color.surface2"),
          }}
        >
          <Text
            style={{
              fontSize: t.type.size.l,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.bold,
            }}
          >
            −
          </Text>
        </Pressable>
        <Text
          testID={testID ? `${testID}-value` : undefined}
          style={{
            minWidth: 60,
            textAlign: "center",
            fontSize: t.type.size.l,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.mono,
            fontVariant: ["tabular-nums"],
          }}
        >
          {hhmm}
        </Text>
        <Pressable
          testID={testID ? `${testID}-inc` : undefined}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("settings.notifications.increment")}
          disabled={disabled}
          onPress={() => step(1)}
          style={{
            width: t.minTouchTarget,
            height: t.minTouchTarget,
            borderRadius: t.radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.color("color.surface2"),
          }}
        >
          <Text
            style={{
              fontSize: t.type.size.l,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.bold,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
