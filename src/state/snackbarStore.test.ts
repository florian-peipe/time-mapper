import { useSnackbarStore, DEFAULT_SNACK_TTL_MS } from "./snackbarStore";

beforeEach(() => {
  useSnackbarStore.setState({ current: null, seq: 0 });
});

describe("snackbarStore", () => {
  it("starts empty", () => {
    expect(useSnackbarStore.getState().current).toBeNull();
  });

  it("show() creates a snack and returns its id", () => {
    const id = useSnackbarStore.getState().show({ message: "saved" });
    expect(id).toMatch(/^snack-/);
    const cur = useSnackbarStore.getState().current;
    expect(cur?.message).toBe("saved");
    expect(cur?.ttlMs).toBe(DEFAULT_SNACK_TTL_MS);
    expect(cur?.action).toBeUndefined();
  });

  it("show() carries the action and custom ttl", () => {
    const onPress = jest.fn();
    useSnackbarStore
      .getState()
      .show({ message: "deleted", action: { label: "Undo", onPress }, ttlMs: 3000 });
    const cur = useSnackbarStore.getState().current;
    expect(cur?.action?.label).toBe("Undo");
    expect(cur?.ttlMs).toBe(3000);
  });

  it("dismiss() clears the current snack", () => {
    useSnackbarStore.getState().show({ message: "hi" });
    useSnackbarStore.getState().dismiss();
    expect(useSnackbarStore.getState().current).toBeNull();
  });

  it("show() replaces the prior snack", () => {
    const first = useSnackbarStore.getState().show({ message: "a" });
    const second = useSnackbarStore.getState().show({ message: "b" });
    expect(first).not.toBe(second);
    expect(useSnackbarStore.getState().current?.message).toBe("b");
  });

  it("dismiss(id) is a no-op when ids don't match — stale timer guard", () => {
    useSnackbarStore.getState().show({ message: "first" });
    const firstId = useSnackbarStore.getState().current?.id;
    expect(firstId).toBeDefined();
    useSnackbarStore.getState().show({ message: "second" });

    // A stale timer attempting to dismiss "first" must not clear "second".
    useSnackbarStore.getState().dismiss(firstId);
    expect(useSnackbarStore.getState().current?.message).toBe("second");
  });

  it("seq increments so each snack gets a unique id", () => {
    const a = useSnackbarStore.getState().show({ message: "a" });
    const b = useSnackbarStore.getState().show({ message: "b" });
    const c = useSnackbarStore.getState().show({ message: "c" });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
