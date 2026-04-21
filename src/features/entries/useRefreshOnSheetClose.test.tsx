import { renderHook, act } from "@testing-library/react-native";
import { useSheetStore } from "@/state/sheetStore";
import type { SheetName } from "@/state/sheetStore";
import { useRefreshOnSheetClose } from "./useRefreshOnSheetClose";

beforeEach(() => {
  useSheetStore.setState({ active: null, payload: null });
});

describe("useRefreshOnSheetClose", () => {
  it("does not call refresh on initial mount when no sheet is open", () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnSheetClose(["entryEdit"], refresh));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("calls refresh when the watched sheet transitions to closed", () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnSheetClose(["entryEdit"], refresh));
    act(() => useSheetStore.getState().openSheet("entryEdit", { entryId: null }));
    // Opening should not fire refresh — that only happens on close.
    expect(refresh).not.toHaveBeenCalled();
    act(() => useSheetStore.getState().closeSheet());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not call refresh when an unrelated sheet closes", () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnSheetClose(["entryEdit"], refresh));
    act(() => useSheetStore.getState().openSheet("addPlace"));
    act(() => useSheetStore.getState().closeSheet());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("watches multiple sheet names — any of them closing fires refresh", () => {
    const refresh = jest.fn();
    const names: SheetName[] = ["entryEdit", "addPlace"];
    renderHook(() => useRefreshOnSheetClose(names, refresh));
    act(() => useSheetStore.getState().openSheet("addPlace"));
    act(() => useSheetStore.getState().closeSheet());
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => useSheetStore.getState().openSheet("entryEdit", { entryId: null }));
    act(() => useSheetStore.getState().closeSheet());
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("calls refresh once per close, even if the component re-renders", () => {
    const refresh = jest.fn();
    const { rerender } = renderHook(() => useRefreshOnSheetClose(["entryEdit"], refresh));
    act(() => useSheetStore.getState().openSheet("entryEdit", { entryId: null }));
    rerender(undefined);
    act(() => useSheetStore.getState().closeSheet());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("switching directly between two sheets (open → open different) does not fire refresh", () => {
    // This matches real UX where one sheet replaces another without
    // transitioning through null.
    const refresh = jest.fn();
    renderHook(() => useRefreshOnSheetClose(["entryEdit"], refresh));
    act(() => useSheetStore.getState().openSheet("entryEdit", { entryId: null }));
    act(() => useSheetStore.getState().openSheet("addPlace"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("treats a single string name as shorthand for a one-element list", () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnSheetClose("entryEdit", refresh));
    act(() => useSheetStore.getState().openSheet("entryEdit", { entryId: null }));
    act(() => useSheetStore.getState().closeSheet());
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
