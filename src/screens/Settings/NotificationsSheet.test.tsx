import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import { getQuietHours, setQuietHours } from "@/features/notifications/notifier";
import { NotificationsSheet } from "./NotificationsSheet";

function mount(initialQuiet?: { startH: number; endH: number } | null) {
  const db = createTestDb();
  const kv = new KvRepo(db);
  if (initialQuiet) setQuietHours(kv, initialQuiet);
  const onClose = jest.fn();
  const utils = render(
    <ThemeProvider schemeOverride="light">
      <KvRepoProvider value={kv}>
        <NotificationsSheet visible onClose={onClose} />
      </KvRepoProvider>
    </ThemeProvider>,
  );
  return { ...utils, kv, onClose };
}

describe("NotificationsSheet", () => {
  it("shows the toggle in disabled state when no quiet hours are stored", () => {
    mount();
    const toggle = screen.getByTestId("notifications-toggle");
    expect(toggle.props.accessibilityState?.checked).toBe(false);
  });

  it("hydrates with existing quiet hours from KV", () => {
    mount({ startH: 21, endH: 8 });
    expect(screen.getByTestId("notifications-toggle").props.accessibilityState?.checked).toBe(true);
    expect(screen.getByTestId("notifications-start-value").props.children).toBe("21:00");
    expect(screen.getByTestId("notifications-end-value").props.children).toBe("08:00");
  });

  it("persists new quiet hours when toggled on and saved", () => {
    const { kv, onClose } = mount();
    // Enable toggle
    fireEvent.press(screen.getByTestId("notifications-toggle"));
    // Bump start up one hour (22 → 23).
    fireEvent.press(screen.getByTestId("notifications-start-inc"));
    fireEvent.press(screen.getByTestId("notifications-sheet-save"));
    const q = getQuietHours(kv);
    expect(q?.startH).toBe(23);
    expect(q?.endH).toBe(7);
    expect(onClose).toHaveBeenCalled();
  });

  it("clears quiet hours when the toggle is off and the user saves", () => {
    const { kv, onClose } = mount({ startH: 21, endH: 8 });
    fireEvent.press(screen.getByTestId("notifications-toggle"));
    fireEvent.press(screen.getByTestId("notifications-sheet-save"));
    expect(getQuietHours(kv)).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses to save when start equals end (zero-length window)", () => {
    const { kv, onClose } = mount();
    // Enable
    fireEvent.press(screen.getByTestId("notifications-toggle"));
    // Tap decrement on start until it matches end (default 7 → 22..7 path).
    // Easier: bump end up until matches start 22.
    const incEnd = () => fireEvent.press(screen.getByTestId("notifications-end-inc"));
    // end starts at 7; bump to 22 → 15 presses
    for (let i = 0; i < 15; i += 1) incEnd();
    // Now start=22, end=22 → invalid.
    fireEvent.press(screen.getByTestId("notifications-sheet-save"));
    // Save should have been blocked (toggle-save refuses and no KV mutation).
    expect(getQuietHours(kv)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
