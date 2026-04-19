import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import {
  BuffersSheet,
  KV_GLOBAL_ENTRY_BUFFER,
  KV_GLOBAL_EXIT_BUFFER,
  readGlobalBuffers,
  DEFAULT_ENTRY_BUFFER_S,
  DEFAULT_EXIT_BUFFER_S,
} from "./BuffersSheet";

function mount(initial?: { entryS?: number; exitS?: number }) {
  const db = createTestDb();
  const kv = new KvRepo(db);
  if (initial?.entryS != null) kv.set(KV_GLOBAL_ENTRY_BUFFER, String(initial.entryS));
  if (initial?.exitS != null) kv.set(KV_GLOBAL_EXIT_BUFFER, String(initial.exitS));
  const onClose = jest.fn();
  const utils = render(
    <ThemeProvider schemeOverride="light">
      <KvRepoProvider value={kv}>
        <BuffersSheet visible onClose={onClose} />
      </KvRepoProvider>
    </ThemeProvider>,
  );
  return { ...utils, kv, onClose };
}

describe("BuffersSheet", () => {
  it("renders with the default entry/exit minutes when KV is empty", () => {
    mount();
    expect(screen.getByText("Entry buffer")).toBeTruthy();
    expect(screen.getByText("Exit buffer")).toBeTruthy();
    // The default minute-readouts (5 min / 3 min).
    expect(screen.getByTestId("buffers-entry-value")).toBeTruthy();
    expect(screen.getByTestId("buffers-exit-value")).toBeTruthy();
  });

  it("hydrates the sliders from KV when persisted values exist", () => {
    mount({ entryS: 9 * 60, exitS: 4 * 60 });
    expect(screen.getByTestId("buffers-entry-value").props.children).toBe("9 min");
    expect(screen.getByTestId("buffers-exit-value").props.children).toBe("4 min");
  });

  it("writes minute values (converted to seconds) to KV on save", () => {
    const { kv, onClose } = mount();
    fireEvent(screen.getByTestId("buffers-entry"), "valueChange", 8);
    fireEvent(screen.getByTestId("buffers-exit"), "valueChange", 5);
    fireEvent.press(screen.getByTestId("buffers-sheet-save"));
    expect(kv.get(KV_GLOBAL_ENTRY_BUFFER)).toBe(String(8 * 60));
    expect(kv.get(KV_GLOBAL_EXIT_BUFFER)).toBe(String(5 * 60));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("readGlobalBuffers", () => {
  it("returns defaults when KV has no values", () => {
    const db = createTestDb();
    const kv = new KvRepo(db);
    const result = readGlobalBuffers(kv);
    expect(result.entryBufferS).toBe(DEFAULT_ENTRY_BUFFER_S);
    expect(result.exitBufferS).toBe(DEFAULT_EXIT_BUFFER_S);
  });

  it("returns parsed values when KV has valid values", () => {
    const db = createTestDb();
    const kv = new KvRepo(db);
    kv.set(KV_GLOBAL_ENTRY_BUFFER, String(600));
    kv.set(KV_GLOBAL_EXIT_BUFFER, String(120));
    const result = readGlobalBuffers(kv);
    expect(result.entryBufferS).toBe(600);
    expect(result.exitBufferS).toBe(120);
  });

  it("falls back to defaults when KV has malformed values", () => {
    const db = createTestDb();
    const kv = new KvRepo(db);
    kv.set(KV_GLOBAL_ENTRY_BUFFER, "not-a-number");
    const result = readGlobalBuffers(kv);
    expect(result.entryBufferS).toBe(DEFAULT_ENTRY_BUFFER_S);
  });
});
