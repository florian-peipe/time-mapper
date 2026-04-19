import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useSnackbarStore } from "@/state/snackbarStore";
import { SnackbarHost } from "./Snackbar";

function wrap() {
  return (
    <ThemeProvider>
      <SnackbarHost />
    </ThemeProvider>
  );
}

beforeEach(() => {
  useSnackbarStore.setState({ current: null, seq: 0 });
});

describe("SnackbarHost", () => {
  it("renders nothing when no snack is queued", () => {
    const { toJSON } = render(wrap());
    expect(toJSON()).toBeNull();
  });

  it("renders the message when a snack is pushed", () => {
    render(wrap());
    act(() => {
      useSnackbarStore.getState().show({ message: "Entry deleted" });
    });
    expect(screen.getByTestId("snackbar-message").props.children).toBe("Entry deleted");
  });

  it("fires the action onPress and dismisses", () => {
    const onUndo = jest.fn();
    render(wrap());
    act(() => {
      useSnackbarStore.getState().show({
        message: "Entry deleted",
        action: { label: "Undo", onPress: onUndo },
      });
    });
    const btn = screen.getByTestId("snackbar-action");
    act(() => {
      fireEvent.press(btn);
    });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(useSnackbarStore.getState().current).toBeNull();
  });

  it("auto-dismisses after its TTL", () => {
    jest.useFakeTimers();
    render(wrap());
    act(() => {
      useSnackbarStore.getState().show({ message: "Saved", ttlMs: 5000 });
    });
    expect(useSnackbarStore.getState().current).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(useSnackbarStore.getState().current).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(useSnackbarStore.getState().current).toBeNull();
    jest.useRealTimers();
  });

  it("replacing the snack cancels the prior timer (no stale dismiss)", () => {
    jest.useFakeTimers();
    render(wrap());
    act(() => {
      useSnackbarStore.getState().show({ message: "first", ttlMs: 5000 });
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => {
      useSnackbarStore.getState().show({ message: "second", ttlMs: 5000 });
    });
    // Advance past when "first" would have dismissed.
    act(() => {
      jest.advanceTimersByTime(3001);
    });
    // "second" is still live (its 5s hasn't elapsed yet — only ~3s of it).
    expect(useSnackbarStore.getState().current?.message).toBe("second");
    // Complete "second"'s TTL.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(useSnackbarStore.getState().current).toBeNull();
    jest.useRealTimers();
  });
});
