import { useSheetStore } from "./sheetStore";

beforeEach(() => useSheetStore.setState({ active: null, payload: null }));

describe("sheetStore", () => {
  it("starts with no active sheet", () => {
    const s = useSheetStore.getState();
    expect(s.active).toBeNull();
    expect(s.payload).toBeNull();
  });

  it("opens entryEdit and closes it with a payload", () => {
    useSheetStore.getState().openSheet("entryEdit", { entryId: "abc-123" });
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toEqual({ entryId: "abc-123" });

    useSheetStore.getState().closeSheet();
    expect(useSheetStore.getState().active).toBeNull();
    expect(useSheetStore.getState().payload).toBeNull();
  });

  it("opens addPlace with a placeId payload", () => {
    useSheetStore.getState().openSheet("addPlace", { placeId: "abc-123" });
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({ placeId: "abc-123" });
  });

  it("opens addPlace without an explicit payload (null default)", () => {
    useSheetStore.getState().openSheet("addPlace");
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toBeNull();
  });

  it("replaces prior payload when a new sheet is opened", () => {
    useSheetStore.getState().openSheet("addPlace", { placeId: "p1" });
    useSheetStore.getState().openSheet("entryEdit", { entryId: null });
    expect(useSheetStore.getState().active).toBe("entryEdit");
    expect(useSheetStore.getState().payload).toEqual({ entryId: null });
  });
});
