import React from "react";
import { i18n } from "@/lib/i18n";
import { BufferSliderRow } from "./BufferSliderRow";

/**
 * Entry/exit buffer slider pair. Rendered as a Fragment so each slider row
 * participates directly in the outer column's gap. The two rows carry their
 * own labels (the "header" for each pair) — there's no section title above
 * them; this matches the original inline layout exactly.
 */
// Entry bias tends to be longer than exit bias — matches the state machine's
// dwell thresholds and mirrors the global-default pair in Settings.
const ENTRY_BUFFER_MIN_MIN = 1;
const ENTRY_BUFFER_MAX_MIN = 15;
const EXIT_BUFFER_MIN_MIN = 1;
const EXIT_BUFFER_MAX_MIN = 10;

export function BuffersCard({
  entryBufferMin,
  onChangeEntryBufferMin,
  exitBufferMin,
  onChangeExitBufferMin,
  visible,
}: {
  entryBufferMin: number;
  onChangeEntryBufferMin: (v: number) => void;
  exitBufferMin: number;
  onChangeExitBufferMin: (v: number) => void;
  /** Forwarded to each slider so it remounts when the sheet reopens. */
  visible: boolean;
}) {
  return (
    <>
      <BufferSliderRow
        label={i18n.t("addPlace.field.entryBuffer")}
        minutes={entryBufferMin}
        minValue={ENTRY_BUFFER_MIN_MIN}
        maxValue={ENTRY_BUFFER_MAX_MIN}
        onChange={onChangeEntryBufferMin}
        testID="add-place-entry-buffer"
        visible={visible}
      />
      <BufferSliderRow
        label={i18n.t("addPlace.field.exitBuffer")}
        minutes={exitBufferMin}
        minValue={EXIT_BUFFER_MIN_MIN}
        maxValue={EXIT_BUFFER_MAX_MIN}
        onChange={onChangeExitBufferMin}
        testID="add-place-exit-buffer"
        visible={visible}
      />
    </>
  );
}
