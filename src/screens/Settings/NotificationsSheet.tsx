import React, { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Sheet } from "@/components";
import { useKvRepo } from "@/features/onboarding/useOnboardingGate";
import {
  getQuietHours,
  setQuietHours,
  type QuietHours,
  getDailyDigestEnabled,
  getDailyDigestHour,
  setDailyDigestSchedule,
} from "@/features/notifications/notifier";
import { i18n } from "@/lib/i18n";
import { QuietHoursSection } from "./QuietHoursSection";
import { DigestSection } from "./DigestSection";
import {
  DEFAULT_DIGEST_HOUR,
  DEFAULT_QUIET_END_H,
  DEFAULT_QUIET_START_H,
  isQuietRangeInvalid,
} from "./notificationsUtils";

export type NotificationsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Settings sheet grouping quiet hours + daily digest — both share a
 * "time-of-day" UX so they live on one screen. This component is a thin
 * orchestrator: it hydrates from KV when opened, delegates rendering to the
 * two section components, and persists atomically on Save.
 *
 * Design decision: hour-only pickers (not HH:MM). The notifier backend
 * stores hour-granularity; offering richer pickers would invite truncation
 * on save. See `HourRow`.
 */
export function NotificationsSheet({ visible, onClose }: NotificationsSheetProps) {
  const t = useTheme();
  const kv = useKvRepo();

  const [enabled, setEnabled] = useState(false);
  const [startH, setStartH] = useState(DEFAULT_QUIET_START_H);
  const [endH, setEndH] = useState(DEFAULT_QUIET_END_H);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestHour, setDigestHour] = useState(DEFAULT_DIGEST_HOUR);

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
    setDigestEnabled(getDailyDigestEnabled(kv));
    setDigestHour(getDailyDigestHour(kv));
  }, [visible, kv]);

  const handleSave = useCallback(() => {
    // Persist quiet hours first (synchronous KV). Save is blocked on an
    // invalid zero-width window — handled by the disabled-Save + error
    // message rendered inside QuietHoursSection.
    if (!enabled) {
      setQuietHours(kv, null);
    } else {
      if (startH === endH) return;
      const q: QuietHours = { startH, endH };
      setQuietHours(kv, q);
    }
    // Fire-and-forget the digest schedule — it needs a native call but
    // we don't want to block the user on it. Errors are logged inside.
    void setDailyDigestSchedule(kv, { enabled: digestEnabled, hour: digestHour });
    onClose();
  }, [enabled, startH, endH, digestEnabled, digestHour, kv, onClose]);

  const rangeInvalid = isQuietRangeInvalid(enabled, startH, endH);

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

      <QuietHoursSection
        enabled={enabled}
        startH={startH}
        endH={endH}
        onToggle={() => setEnabled((v) => !v)}
        onChangeStart={setStartH}
        onChangeEnd={setEndH}
      />

      {/* Daily digest — scheduled reminder at a user-chosen hour. Independent
          of quiet hours: you can turn either on or off on its own. */}
      <DigestSection
        enabled={digestEnabled}
        hour={digestHour}
        onToggle={() => setDigestEnabled((v) => !v)}
        onChangeHour={setDigestHour}
      />
    </Sheet>
  );
}
