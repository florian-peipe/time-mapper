import { useSheetStore } from "./sheetStore";

beforeEach(() => useSheetStore.setState({ active: null, payload: null }));

describe("sheetStore", () => {
  it("starts with no active sheet", () => {
    const s = useSheetStore.getState();
    expect(s.active).toBeNull();
    expect(s.payload).toBeNull();
  });

  it("opens and closes the paywall with payload", () => {
    useSheetStore.getState().openSheet("paywall", { source: "2nd-place" });
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toEqual({ source: "2nd-place" });

    useSheetStore.getState().closeSheet();
    expect(useSheetStore.getState().active).toBeNull();
    expect(useSheetStore.getState().payload).toBeNull();
  });

  it("opens entryEdit with an entry payload", () => {
    useSheetStore.getState().openSheet("entryEdit", { entryId: "abc-123" });
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toEqual({ entryId: "abc-123" });
  });

  it("opens addPlace without an explicit payload (null default)", () => {
    useSheetStore.getState().openSheet("addPlace");
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toBeNull();
  });

  it("replaces prior payload when a new sheet is opened", () => {
    useSheetStore.getState().openSheet("paywall", { source: "settings" });
    useSheetStore.getState().openSheet("entryEdit", { entryId: null });
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toEqual({ entryId: null });
  });
});
