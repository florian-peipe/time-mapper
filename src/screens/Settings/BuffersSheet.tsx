import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { Button, Sheet } from "@/components";
import { useKvRepo } from "@/features/onboarding/useOnboardingGate";
import { i18n } from "@/lib/i18n";

export type BuffersSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * KV keys for the global default entry/exit buffers (in seconds). Exported
 * so `AddPlaceSheet` can read the same values when pre-filling its per-place
 * buffer sliders.
 */
export const KV_GLOBAL_ENTRY_BUFFER = "global.buffers.entry_s";
export const KV_GLOBAL_EXIT_BUFFER = "global.buffers.exit_s";

/** Defaults (seconds) when the user hasn't picked custom values yet. */
export const DEFAULT_ENTRY_BUFFER_S = 120;
export const DEFAULT_EXIT_BUFFER_S = 60;

/** Slider bounds (minutes). */
const ENTRY_MIN_MIN = 1;
const ENTRY_MAX_MIN = 15;
const EXIT_MIN_MIN = 1;
const EXIT_MAX_MIN = 10;

/**
 * Read the currently-persisted buffer defaults from KV. Exported so
 * `AddPlaceSheet` can pre-fill its per-place sliders from the same values.
 */
export function readGlobalBuffers(kv: { get: (k: string) => string | null }): {
  entryBufferS: number;
  exitBufferS: number;
} {
  const entryRaw = kv.get(KV_GLOBAL_ENTRY_BUFFER);
  const exitRaw = kv.get(KV_GLOBAL_EXIT_BUFFER);
  const entry = entryRaw ? parseInt(entryRaw, 10) : NaN;
  const exit = exitRaw ? parseInt(exitRaw, 10) : NaN;
  return {
    entryBufferS: Number.isFinite(entry) && entry > 0 ? entry : DEFAULT_ENTRY_BUFFER_S,
    exitBufferS: Number.isFinite(exit) && exit > 0 ? exit : DEFAULT_EXIT_BUFFER_S,
  };
}

/**
 * Small modal for adjusting the app-wide default entry/exit buffers. Persists
 * to KV so `AddPlaceSheet` can read the latest defaults when the user creates
 * a new place. Existing places are not mutated (the schema stores per-place
 * values; this is only the "new place" default).
 */
export function BuffersSheet({ visible, onClose }: BuffersSheetProps) {
  const t = useTheme();
  const kv = useKvRepo();

  const [entryMin, setEntryMin] = useState(Math.round(DEFAULT_ENTRY_BUFFER_S / 60));
  const [exitMin, setExitMin] = useState(Math.round(DEFAULT_EXIT_BUFFER_S / 60));

  // Hydrate from KV each time the sheet opens so a dev-tool-driven change
  // outside the sheet still shows the latest values.
  useEffect(() => {
    if (!visible) return;
    const { entryBufferS, exitBufferS } = readGlobalBuffers(kv);
    setEntryMin(Math.round(entryBufferS / 60));
    setExitMin(Math.round(exitBufferS / 60));
  }, [visible, kv]);

  const handleSave = useCallback(() => {
    kv.set(KV_GLOBAL_ENTRY_BUFFER, String(entryMin * 60));
    kv.set(KV_GLOBAL_EXIT_BUFFER, String(exitMin * 60));
    onClose();
  }, [kv, entryMin, exitMin, onClose]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={70}
      title={i18n.t("settings.buffers.title")}
      testID="buffers-sheet"
      footer={
        <Button variant="primary" size="md" full onPress={handleSave} testID="buffers-sheet-save">
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
        {i18n.t("settings.buffers.body")}
      </Text>

      <BufferRow
        label={i18n.t("settings.buffers.entry")}
        minutes={entryMin}
        minValue={ENTRY_MIN_MIN}
        maxValue={ENTRY_MAX_MIN}
        onChange={setEntryMin}
        testID="buffers-entry"
        visible={visible}
      />
      <View style={{ height: t.space[5] }} />
      <BufferRow
        label={i18n.t("settings.buffers.exit")}
        minutes={exitMin}
        minValue={EXIT_MIN_MIN}
        maxValue={EXIT_MAX_MIN}
        onChange={setExitMin}
        testID="buffers-exit"
        visible={visible}
      />
    </Sheet>
  );
}

function BufferRow({
  label,
  minutes,
  minValue,
  maxValue,
  onChange,
  testID,
  visible,
}: {
  label: string;
  minutes: number;
  minValue: number;
  maxValue: number;
  onChange: (v: number) => void;
  testID?: string;
  /** Remount the native Slider when the sheet opens so the UISlider
   *  thumb position syncs with the current `value`. */
  visible: boolean;
}) {
  const t = useTheme();
  const minutesLabel = i18n.t("settings.buffers.minutesSuffix", { n: minutes });
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: t.space[2],
        }}
      >
        <Text
          accessibilityRole="text"
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            fontWeight: t.type.weight.medium,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.s,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            fontVariant: ["tabular-nums"],
          }}
          testID={testID ? `${testID}-value` : undefined}
        >
          {minutesLabel}
        </Text>
      </View>
      <Slider
        key={visible ? "open" : "closed"}
        testID={testID}
        minimumValue={minValue}
        maximumValue={maxValue}
        step={1}
        value={minutes}
        onValueChange={(v: number) => onChange(Math.round(v))}
        minimumTrackTintColor={t.color("color.accent")}
        maximumTrackTintColor={t.color("color.border")}
        thumbTintColor={t.color("color.accent")}
        style={{ width: "100%", height: 28 }}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: minValue, max: maxValue, now: minutes, text: minutesLabel }}
      />
    </View>
  );
}
